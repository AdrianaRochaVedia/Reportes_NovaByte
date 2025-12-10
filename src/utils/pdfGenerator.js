const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { REPORTS_OUTPUT_DIR, REPORTS_TEMP_DIR } = require('../config');

class PDFGenerator {
  constructor() {
    this.outputDir = REPORTS_OUTPUT_DIR;
    this.tempDir = REPORTS_TEMP_DIR;
    this.colors = {
      primary: '#2563eb',      // Azul médico
      secondary: '#64748b',    // Gris
      success: '#10b981',      // Verde
      warning: '#f59e0b',      // Naranja
      danger: '#ef4444',       // Rojo
      light: '#f1f5f9',        // Gris claro
      border: '#cbd5e1',       // Borde
      accent: '#06b6d4',       // Cyan
      textDark: '#1e293b'      // Texto oscuro
    };
    this.fonts = {
      regular: 'Helvetica',
      bold: 'Helvetica-Bold',
      italic: 'Helvetica-Oblique'
    };
    this.fileRetentionTime = 3600000; // 1 hora
    this.cleanupInterval = 24 * 60 * 60 * 1000; // 24 horas
    
    this._initializeDirectories();
    this._startCleanupScheduler();
  }

  _initializeDirectories() {
    [this.outputDir, this.tempDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }



  //HISTORIAL CLINICO DE PACIENTE
  
  async generarHistoriaClinicaPDF(datos, filtro) {
    const timestamp = Date.now();
    const fileName = `historia_clinica_${datos.paciente.nombre}_${timestamp}.pdf`;
    const filePath = path.join(this.outputDir, fileName);
    
    const doc = new PDFDocument({ 
      autoFirstPage: false,
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });
    
    doc.pipe(fs.createWriteStream(filePath));

    let pageNumber = 1;

    // Portada
    this._addPortadaMedica(doc, 'Historia Clínica');
    
    // Página 1: Datos del paciente
    doc.addPage();
    this._addHeaderMedico(doc, 'Historia Clínica Completa');
    this._addDatosPaciente(doc, datos.paciente);
    this._addFooter(doc, pageNumber++);

    // Página 2: Antecedentes y Alergias
    if (datos.antecedentes?.length > 0 || datos.alergias?.length > 0) {
      doc.addPage();
      this._addHeaderMedico(doc, 'Historia Clínica Completa');
      
      if (datos.antecedentes?.length > 0) {
        this._addAntecedentes(doc, datos.antecedentes);
      }
      
      if (datos.alergias?.length > 0) {
        this._addAlergias(doc, datos.alergias);
      }
      
      this._addFooter(doc, pageNumber++);
    }

    // Páginas siguientes: Consultas
    if (datos.consultas && datos.consultas.length > 0) {
      for (const consulta of datos.consultas) {
        doc.addPage();
        this._addHeaderMedico(doc, 'Historia Clínica Completa');
        this._addConsultaDetalle(doc, consulta);
        this._addFooter(doc, pageNumber++);
      }
    }

    // Página de gráfica de signos vitales
    const signosVitalesData = this._extractSignosVitalesData(datos.consultas);
    if (signosVitalesData.length > 1) {
      try {
        const chartImage = await this._generateSignosVitalesChart(signosVitalesData);
        doc.addPage();
        this._addHeaderMedico(doc, 'Historia Clínica Completa');
        doc.fontSize(14).font(this.fonts.bold).fillColor(this.colors.primary)
          .text('Evolución de Signos Vitales', 50, doc.y);
        doc.moveDown(1);
        this._addChartToPage(doc, chartImage);
        this._addFooter(doc, pageNumber++);
      } catch (err) {
        console.error('Error generando gráfica de signos vitales:', err);
      }
    }

    doc.end();
    return this._createFileInfoPromise(fileName, filePath);
  }

  _addDatosPaciente(doc, paciente) {
    doc.fontSize(16).font(this.fonts.bold).fillColor(this.colors.primary)
      .text('Datos del Paciente', 50);
    doc.moveDown(0.5);

    const boxY = doc.y;
    const boxHeight = 140;
    doc.rect(50, boxY, doc.page.width - 100, boxHeight)
      .fillColor(this.colors.light).fill();

    doc.fontSize(11).font(this.fonts.regular).fillColor(this.colors.textDark);
    
    let currentY = boxY + 15;
    const leftCol = 70;
    const rightCol = 350;

    // Columna izquierda
    doc.font(this.fonts.bold).text('Nombre completo:', leftCol, currentY);
    doc.font(this.fonts.regular).text(
      `${paciente.nombre} ${paciente.apellidos}`, 
      leftCol, currentY + 15
    );
    
    currentY += 40;
    doc.font(this.fonts.bold).text('Email:', leftCol, currentY);
    doc.font(this.fonts.regular).text(paciente.email || 'No registrado', leftCol, currentY + 15);
    
    // Columna derecha
    currentY = boxY + 15;
    doc.font(this.fonts.bold).text('Fecha de nacimiento:', rightCol, currentY);
    doc.font(this.fonts.regular).text(
      paciente.fecha_nacimiento 
        ? moment(paciente.fecha_nacimiento).format('DD/MM/YYYY')
        : 'No registrada',
      rightCol, currentY + 15
    );
    
    currentY += 40;
    doc.font(this.fonts.bold).text('Edad:', rightCol, currentY);
    doc.font(this.fonts.regular).text(
      paciente.edad ? `${paciente.edad} años` : 'No calculada',
      rightCol, currentY + 15
    );

    doc.moveDown(10);
  }

  _addAntecedentes(doc, antecedentes) {
    doc.fontSize(14).font(this.fonts.bold).fillColor(this.colors.primary)
      .text('Antecedentes Médicos', 50);
    doc.moveDown(0.5);

    antecedentes.forEach((ant, idx) => {
      doc.fontSize(10).font(this.fonts.bold).fillColor(this.colors.textDark)
        .text(`${idx + 1}. ${ant.tipo}`, 70);
      doc.fontSize(10).font(this.fonts.regular)
        .text(ant.descripcion, 70, doc.y, { width: doc.page.width - 140 });
      doc.moveDown(0.5);
    });

    doc.moveDown(1);
  }

  _addAlergias(doc, alergias) {
    doc.fontSize(14).font(this.fonts.bold).fillColor(this.colors.danger)
      .text(' Alergias', 50);
    doc.moveDown(0.5);

    const boxY = doc.y;
    const boxHeight = Math.min(100, 20 + alergias.length * 25);
    
    doc.rect(50, boxY, doc.page.width - 100, boxHeight)
      .fillColor('#fee2e2').fill();

    let currentY = boxY + 10;
    alergias.forEach((alergia) => {
      doc.fontSize(10).font(this.fonts.bold).fillColor(this.colors.danger)
        .text(`• ${alergia.sustancia}`, 70, currentY);
      doc.font(this.fonts.regular).fillColor(this.colors.textDark)
        .text(
          `Severidad: ${alergia.severidad || 'No especificada'}`,
          90, currentY + 12
        );
      currentY += 25;
    });

    doc.moveDown(5);
  }

  _addConsultaDetalle(doc, consulta) {
    // Fecha y médico
    doc.fontSize(14).font(this.fonts.bold).fillColor(this.colors.primary)
      .text(`Consulta - ${moment(consulta.created_at).format('DD/MM/YYYY')}`, 50);
    
    if (consulta.medico) {
      doc.fontSize(10).font(this.fonts.italic).fillColor(this.colors.secondary)
        .text(
          `Dr(a). ${consulta.medico.nombre} ${consulta.medico.apellidos} - ${consulta.medico.especialidad || ''}`,
          50
        );
    }
    
    doc.moveDown(1);

    // Motivo
    if (consulta.motivo) {
      this._addSection(doc, 'Motivo de consulta', consulta.motivo);
    }

    // Signos vitales
    if (consulta.signosVitales) {
      this._addSignosVitales(doc, consulta.signosVitales);
    }

    // Anamnesis
    if (consulta.anamnesis) {
      this._addSection(doc, 'Anamnesis', consulta.anamnesis);
    }

    // Examen físico
    if (consulta.examen_fisico) {
      this._addSection(doc, 'Examen Físico', consulta.examen_fisico);
    }

    // Diagnósticos
    if (consulta.diagnosticos && consulta.diagnosticos.length > 0) {
      this._addDiagnosticos(doc, consulta.diagnosticos);
    }

    // Plan
    if (consulta.plan) {
      this._addSection(doc, 'Plan', consulta.plan);
    }

    // Receta
    if (consulta.receta && consulta.receta.items) {
      this._addReceta(doc, consulta.receta);
    }

    // Observaciones
    if (consulta.observaciones) {
      this._addSection(doc, 'Observaciones', consulta.observaciones);
    }
  }

  _addSection(doc, titulo, contenido) {
    doc.fontSize(11).font(this.fonts.bold).fillColor(this.colors.primary)
      .text(titulo, 50);
    doc.fontSize(10).font(this.fonts.regular).fillColor(this.colors.textDark)
      .text(contenido, 70, doc.y, { width: doc.page.width - 140 });
    doc.moveDown(1);
  }

  _addSignosVitales(doc, signos) {
    doc.fontSize(11).font(this.fonts.bold).fillColor(this.colors.primary)
      .text('Signos Vitales', 50);
    doc.moveDown(0.3);

    const boxY = doc.y;
    const boxHeight = 80;
    doc.rect(50, boxY, doc.page.width - 100, boxHeight)
      .fillColor(this.colors.light).fill();

    doc.fontSize(9).font(this.fonts.regular).fillColor(this.colors.textDark);
    
    let currentY = boxY + 10;
    const col1 = 70;
    const col2 = 220;
    const col3 = 370;

    if (signos.presion_sistolica && signos.presion_diastolica) {
      doc.text(`PA: ${signos.presion_sistolica}/${signos.presion_diastolica} mmHg`, col1, currentY);
    }
    if (signos.frecuencia_cardiaca) {
      doc.text(`FC: ${signos.frecuencia_cardiaca} lpm`, col2, currentY);
    }
    if (signos.temperatura) {
      doc.text(`T°: ${signos.temperatura} °C`, col3, currentY);
    }

    currentY += 20;
    if (signos.saturacion_oxigeno) {
      doc.text(`SpO2: ${signos.saturacion_oxigeno}%`, col1, currentY);
    }
    if (signos.peso_kg) {
      doc.text(`Peso: ${signos.peso_kg} kg`, col2, currentY);
    }
    if (signos.talla_cm) {
      doc.text(`Talla: ${signos.talla_cm} cm`, col3, currentY);
    }

    doc.moveDown(5);
  }

  _addDiagnosticos(doc, diagnosticos) {
    doc.fontSize(11).font(this.fonts.bold).fillColor(this.colors.primary)
      .text('Diagnósticos', 50);
    doc.moveDown(0.3);

    diagnosticos.forEach((diag, idx) => {
      const prefix = diag.principal ? '★' : '•';
      const color = diag.principal ? this.colors.warning : this.colors.textDark;
      
      doc.fontSize(10).font(this.fonts.regular).fillColor(color)
        .text(
          `${prefix} ${diag.descripcion}${diag.codigo ? ` (${diag.codigo})` : ''}`,
          70
        );
    });

    doc.moveDown(1);
  }

  _addReceta(doc, receta) {
    doc.fontSize(11).font(this.fonts.bold).fillColor(this.colors.primary)
      .text('Receta Médica', 50);
    doc.moveDown(0.5);

    receta.items.forEach((item, idx) => {
      doc.fontSize(10).font(this.fonts.bold).fillColor(this.colors.textDark)
        .text(`${idx + 1}. ${item.medicamento}`, 70);
      
      const detalles = [];
      if (item.dosis) detalles.push(`Dosis: ${item.dosis}`);
      if (item.frecuencia) detalles.push(`Frecuencia: ${item.frecuencia}`);
      if (item.duracion) detalles.push(`Duración: ${item.duracion}`);
      
      doc.fontSize(9).font(this.fonts.regular)
        .text(detalles.join(' | '), 85);
      doc.moveDown(0.5);
    });

    if (receta.indicaciones_generales) {
      doc.fontSize(9).font(this.fonts.italic).fillColor(this.colors.secondary)
        .text(`Indicaciones: ${receta.indicaciones_generales}`, 70);
    }

    doc.moveDown(1);
  }

  _extractSignosVitalesData(consultas) {
    return consultas
      .filter(c => c.signosVitales)
      .map(c => ({
        fecha: moment(c.created_at).format('DD/MM/YY'),
        pa_sistolica: c.signosVitales.presion_sistolica,
        pa_diastolica: c.signosVitales.presion_diastolica,
        fc: c.signosVitales.frecuencia_cardiaca,
        peso: c.signosVitales.peso_kg
      }))
      .reverse();
  }

  async _generateSignosVitalesChart(data) {
    const width = 600;
    const height = 400;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

    const configuration = {
      type: 'line',
      data: {
        labels: data.map(d => d.fecha),
        datasets: [
          {
            label: 'PA Sistólica',
            data: data.map(d => d.pa_sistolica),
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            tension: 0.4
          },
          {
            label: 'PA Diastólica',
            data: data.map(d => d.pa_diastolica),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            tension: 0.4
          },
          {
            label: 'FC (lpm)',
            data: data.map(d => d.fc),
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Evolución de Signos Vitales',
            font: { size: 16 }
          },
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    };

    return await chartJSNodeCanvas.renderToBuffer(configuration);
  }


  //Para agenda de medicos
  
  async generarAgendaMedicoPDF(datos, filtro) {
    const timestamp = Date.now();
    const fileName = `agenda_medico_${timestamp}.pdf`;
    const filePath = path.join(this.outputDir, fileName);
    
    const doc = new PDFDocument({ autoFirstPage: false });
    doc.pipe(fs.createWriteStream(filePath));

    let pageNumber = 1;

    // Portada
    this._addPortadaMedica(doc, 'Agenda Médica');
    
    // Páginas con citas
    doc.addPage();
    this._addHeaderMedico(doc, 'Agenda Médica');
    
    // Info del médico
    doc.fontSize(14).font(this.fonts.bold).fillColor(this.colors.primary)
      .text(`Dr(a). ${datos.medico.nombre} ${datos.medico.apellidos}`, 50);
    doc.fontSize(11).font(this.fonts.regular).fillColor(this.colors.secondary)
      .text(datos.medico.especialidad || '', 50);
    doc.moveDown(0.5);

    // Período
    doc.fontSize(10).font(this.fonts.italic)
      .text(
        `Período: ${moment(filtro.fecha_desde).format('DD/MM/YYYY')} - ${moment(filtro.fecha_hasta).format('DD/MM/YYYY')}`,
        50
      );
    doc.moveDown(1);

    // Tabla de citas
    this._addCitasTable(doc, datos.citas, () => {
      this._addFooter(doc, pageNumber++);
      doc.addPage();
      this._addHeaderMedico(doc, 'Agenda Médica');
    });
    
    this._addFooter(doc, pageNumber++);

    // Gráfica de citas por estado
    try {
      const chartImage = await this._generateCitasPorEstadoChart(datos.citas);
      doc.addPage();
      this._addHeaderMedico(doc, 'Agenda Médica');
      doc.fontSize(14).font(this.fonts.bold).fillColor(this.colors.primary)
        .text('Distribución de Citas por Estado', 50);
      doc.moveDown(1);
      this._addChartToPage(doc, chartImage);
      this._addFooter(doc, pageNumber++);
    } catch (err) {
      console.error('Error generando gráfica de citas:', err);
    }

    doc.end();
    return this._createFileInfoPromise(fileName, filePath);
  }

  _addCitasTable(doc, citas, onNewPage) {
    const startX = 50;
    const baseRowHeight = 25;
    let y = doc.y;
    const footerHeight = 50;

    const columnWidths = {
      fecha: 80,
      hora: 60,
      paciente: 150,
      tipo: 80,
      estado: 70
    };

    const totalWidth = Object.values(columnWidths).reduce((sum, w) => sum + w, 0);

    // Header
    const drawHeader = () => {
      let currentX = startX;
      doc.rect(startX, y, totalWidth, baseRowHeight)
        .fillColor(this.colors.primary).fill();
      
      doc.font(this.fonts.bold).fontSize(10).fillColor('white');
      
      const headers = {
        fecha: 'Fecha',
        hora: 'Hora',
        paciente: 'Paciente',
        tipo: 'Tipo',
        estado: 'Estado'
      };

      Object.entries(headers).forEach(([key, title]) => {
        doc.text(title, currentX + 5, y + 8, {
          width: columnWidths[key] - 10
        });
        currentX += columnWidths[key];
      });
      
      y += baseRowHeight;
    };

    drawHeader();
    doc.font(this.fonts.regular).fontSize(9).fillColor(this.colors.textDark);

    citas.forEach((cita, idx) => {
      if (y + baseRowHeight + footerHeight > doc.page.height) {
        onNewPage();
        y = doc.y;
        drawHeader();
      }

      if (idx % 2 === 0) {
        doc.rect(startX, y, totalWidth, baseRowHeight)
          .fillColor(this.colors.light).fill();
      }

      let currentX = startX;
      
      // Fecha
      doc.fillColor(this.colors.textDark).text(
        moment(cita.fecha_hora).format('DD/MM/YYYY'),
        currentX + 5, y + 8, { width: columnWidths.fecha - 10 }
      );
      currentX += columnWidths.fecha;

      // Hora
      doc.text(
        moment(cita.fecha_hora).format('HH:mm'),
        currentX + 5, y + 8, { width: columnWidths.hora - 10 }
      );
      currentX += columnWidths.hora;

      // Paciente
      doc.text(
        `${cita.paciente?.nombre} ${cita.paciente?.apellidos}`,
        currentX + 5, y + 8, { width: columnWidths.paciente - 10 }
      );
      currentX += columnWidths.paciente;

      // Tipo
      doc.text(
        cita.tipo_cita || 'N/A',
        currentX + 5, y + 8, { width: columnWidths.tipo - 10 }
      );
      currentX += columnWidths.tipo;

      // Estado
      const estadoColors = {
        programada: this.colors.warning,
        completada: this.colors.success,
        cancelada: this.colors.danger
      };
      doc.fillColor(estadoColors[cita.estado] || this.colors.textDark).text(
        cita.estado,
        currentX + 5, y + 8, { width: columnWidths.estado - 10 }
      );

      y += baseRowHeight;
    });
  }

  async _generateCitasPorEstadoChart(citas) {
    const estadoCounts = citas.reduce((acc, cita) => {
      acc[cita.estado] = (acc[cita.estado] || 0) + 1;
      return acc;
    }, {});

    const width = 600;
    const height = 400;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

    const configuration = {
      type: 'pie',
      data: {
        labels: Object.keys(estadoCounts),
        datasets: [{
          data: Object.values(estadoCounts),
          backgroundColor: ['#f59e0b', '#10b981', '#ef4444'],
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Citas por Estado',
            font: { size: 16 }
          },
          legend: {
            display: true,
            position: 'right'
          }
        }
      }
    };

    return await chartJSNodeCanvas.renderToBuffer(configuration);
  }


  // DEsempeño de medicos admin

  async generarDesempenoMedicosPDF(datos, filtro) {
    const timestamp = Date.now();
    const fileName = `desempeno_medicos_${timestamp}.pdf`;
    const filePath = path.join(this.outputDir, fileName);
    
    const doc = new PDFDocument({ autoFirstPage: false });
    doc.pipe(fs.createWriteStream(filePath));

    let pageNumber = 1;

    // Portada
    this._addPortadaMedica(doc, 'Desempeño Médicos');
    
    // Tabla de desempeño
    doc.addPage();
    this._addHeaderMedico(doc, 'Reporte de Desempeño - Médicos');
    
    if (filtro.fecha_desde && filtro.fecha_hasta) {
      doc.fontSize(10).font(this.fonts.italic).fillColor(this.colors.secondary)
        .text(
          `Período: ${moment(filtro.fecha_desde).format('DD/MM/YYYY')} - ${moment(filtro.fecha_hasta).format('DD/MM/YYYY')}`,
          50
        );
      doc.moveDown(1);
    }

    this._addDesempenoTable(doc, datos, () => {
      this._addFooter(doc, pageNumber++);
      doc.addPage();
      this._addHeaderMedico(doc, 'Reporte de Desempeño - Médicos');
    });
    
    this._addFooter(doc, pageNumber++);

    // Gráfica comparativa
    if (datos.length > 1) {
      try {
        const chartImage = await this._generateDesempenoChart(datos);
        doc.addPage();
        this._addHeaderMedico(doc, 'Reporte de Desempeño - Médicos');
        doc.fontSize(14).font(this.fonts.bold).fillColor(this.colors.primary)
          .text('Comparativa de Consultas por Médico', 50);
        doc.moveDown(1);
        this._addChartToPage(doc, chartImage);
        this._addFooter(doc, pageNumber++);
      } catch (err) {
        console.error('Error generando gráfica de desempeño:', err);
      }
    }

    doc.end();
    return this._createFileInfoPromise(fileName, filePath);
  }

  _addDesempenoTable(doc, datos, onNewPage) {
    const startX = 50;
    const baseRowHeight = 25;
    let y = doc.y;
    const footerHeight = 50;

    const columnWidths = {
      medico: 150,
      consultas: 80,
      pacientes: 80,
      promedio: 100
    };

    const totalWidth = Object.values(columnWidths).reduce((sum, w) => sum + w, 0);

    const drawHeader = () => {
      let currentX = startX;
      doc.rect(startX, y, totalWidth, baseRowHeight)
        .fillColor(this.colors.primary).fill();
      
      doc.font(this.fonts.bold).fontSize(10).fillColor('white');
      
      const headers = {
        medico: 'Médico',
        consultas: 'Consultas',
        pacientes: 'Pacientes',
        promedio: 'Promedio/día'
      };

      Object.entries(headers).forEach(([key, title]) => {
        doc.text(title, currentX + 5, y + 8, {
          width: columnWidths[key] - 10
        });
        currentX += columnWidths[key];
      });
      
      y += baseRowHeight;
    };

    drawHeader();
    doc.font(this.fonts.regular).fontSize(9).fillColor(this.colors.textDark);

    datos.forEach((medico, idx) => {
      if (y + baseRowHeight + footerHeight > doc.page.height) {
        onNewPage();
        y = doc.y;
        drawHeader();
      }

      if (idx % 2 === 0) {
        doc.rect(startX, y, totalWidth, baseRowHeight)
          .fillColor(this.colors.light).fill();
      }

      let currentX = startX;
      
      doc.fillColor(this.colors.textDark).text(
        medico.nombre_medico,
        currentX + 5, y + 8, { width: columnWidths.medico - 10 }
      );
      currentX += columnWidths.medico;

      doc.text(
        medico.total_consultas.toString(),
        currentX + 5, y + 8, { width: columnWidths.consultas - 10 }
      );
      currentX += columnWidths.consultas;

      doc.text(
        medico.pacientes_unicos.toString(),
        currentX + 5, y + 8, { width: columnWidths.pacientes - 10 }
      );
      currentX += columnWidths.pacientes;

      doc.text(
        medico.promedio_consultas_dia.toFixed(2),
        currentX + 5, y + 8, { width: columnWidths.promedio - 10 }
      );

      y += baseRowHeight;
    });
  }

async _generateDesempenoChart(datos) {
  const width = 600;
  const height = 400;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

  const configuration = {
    type: 'bar',
    data: {
      labels: datos.map(d => d.nombre_medico.split(' ')[0]),
      datasets: [{
        label: 'Total de Consultas',
        data: datos.map(d => d.total_consultas),
        backgroundColor: '#2563eb',
        borderColor: '#1e40af',
        borderWidth: 1
      }]
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: 'Consultas por Médico',
          font: { size: 16 }
        },
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  };

  return await chartJSNodeCanvas.renderToBuffer(configuration);
}


//REsumen de consultas

async generarResumenConsultasPDF(consultas, filtro) {
const timestamp = Date.now();
const fileName = `resumen_consultas_${timestamp}.pdf`;
const filePath = path.join(this.outputDir, fileName);
const doc = new PDFDocument({ autoFirstPage: false });
doc.pipe(fs.createWriteStream(filePath));

let pageNumber = 1;

this._addPortadaMedica(doc, 'Resumen de Consultas');

doc.addPage();
this._addHeaderMedico(doc, 'Resumen de Consultas');

if (filtro.fecha_desde && filtro.fecha_hasta) {
  doc.fontSize(10).font(this.fonts.italic).fillColor(this.colors.secondary)
    .text(
      `Período: ${moment(filtro.fecha_desde).format('DD/MM/YYYY')} - ${moment(filtro.fecha_hasta).format('DD/MM/YYYY')}`,
      50
    );
  doc.moveDown(1);
}

// Lista de consultas
consultas.forEach((consulta, idx) => {
  if (doc.y > doc.page.height - 150) {
    this._addFooter(doc, pageNumber++);
    doc.addPage();
    this._addHeaderMedico(doc, 'Resumen de Consultas');
  }

  this._addConsultaResumen(doc, consulta);
});

this._addFooter(doc, pageNumber++);

doc.end();
return this._createFileInfoPromise(fileName, filePath);
}
_addConsultaResumen(doc, consulta) {
const boxY = doc.y;
const boxHeight = 80;
doc.rect(50, boxY, doc.page.width - 100, boxHeight)
  .fillColor(this.colors.light).fill();

let currentY = boxY + 10;

doc.fontSize(11).font(this.fonts.bold).fillColor(this.colors.primary)
  .text(
    `${moment(consulta.created_at).format('DD/MM/YYYY HH:mm')}`,
    70, currentY
  );

if (consulta.paciente) {
  doc.fontSize(9).font(this.fonts.regular).fillColor(this.colors.textDark)
    .text(
      `Paciente: ${consulta.paciente.nombre} ${consulta.paciente.apellidos}`,
      70, currentY + 15
    );
}

if (consulta.medico) {
  doc.text(
    `Médico: Dr(a). ${consulta.medico.nombre} ${consulta.medico.apellidos}`,
    70, currentY + 28
  );
}

if (consulta.motivo) {
  doc.text(
    `Motivo: ${consulta.motivo.substring(0, 60)}${consulta.motivo.length > 60 ? '...' : ''}`,
    70, currentY + 41
  );
}

doc.moveDown(6);
}

//PAra el dashboard
async generarDashboardEstadisticasPDF(estadisticas, filtro) {
const timestamp = Date.now();
const fileName = `dashboard_estadisticas_${timestamp}.pdf`;
const filePath = path.join(this.outputDir, fileName);
const doc = new PDFDocument({ autoFirstPage: false });
doc.pipe(fs.createWriteStream(filePath));

let pageNumber = 1;

this._addPortadaMedica(doc, 'Dashboard Estadísticas');

doc.addPage();
this._addHeaderMedico(doc, 'Dashboard - Estadísticas Generales');

if (filtro.fecha_desde && filtro.fecha_hasta) {
  doc.fontSize(10).font(this.fonts.italic).fillColor(this.colors.secondary)
    .text(
      `Período: ${moment(filtro.fecha_desde).format('DD/MM/YYYY')} - ${moment(filtro.fecha_hasta).format('DD/MM/YYYY')}`,
      50
    );
  doc.moveDown(1);
}

// Cards de estadísticas
this._addEstadisticasCards(doc, estadisticas);

this._addFooter(doc, pageNumber++);

doc.end();
return this._createFileInfoPromise(fileName, filePath);
}
_addEstadisticasCards(doc, stats) {
const cards = [
{ label: 'Médicos Activos', value: stats.total_medicos_activos, color: this.colors.primary },
{ label: 'Pacientes', value: stats.total_pacientes, color: this.colors.accent },
{ label: 'Consultas Totales', value: stats.total_consultas, color: this.colors.success },
{ label: 'Consultas Mes Actual', value: stats.consultas_mes_actual, color: this.colors.warning },
{ label: 'Citas Programadas', value: stats.citas_programadas, color: this.colors.secondary },
{ label: 'Citas Completadas', value: stats.citas_completadas, color: this.colors.success }
];
const cardWidth = 170;
const cardHeight = 80;
const spacing = 20;
const startX = 50;
let currentX = startX;
let currentY = doc.y;

cards.forEach((card, idx) => {
  if (idx > 0 && idx % 3 === 0) {
    currentX = startX;
    currentY += cardHeight + spacing;
  }

  doc.rect(currentX, currentY, cardWidth, cardHeight)
    .fillColor(card.color).fill();

  doc.fontSize(20).font(this.fonts.bold).fillColor('white')
    .text(card.value.toString(), currentX + 10, currentY + 15);

  doc.fontSize(10).font(this.fonts.regular)
    .text(card.label, currentX + 10, currentY + 45, {
      width: cardWidth - 20
    });

  currentX += cardWidth + spacing;
});

doc.moveDown(12);
}

// PAra lo de portadas y demas
_addPortadaMedica(doc, titulo) {
doc.addPage({ size: 'A4', margin: 0 });
// Fondo
doc.rect(0, 0, doc.page.width, doc.page.height)
  .fillColor(this.colors.primary).fill();

// Título
doc.fontSize(40).font(this.fonts.bold).fillColor('white')
  .text(titulo, 0, doc.page.height / 2 - 50, {
    align: 'center',
    width: doc.page.width
  });

// Subtítulo
doc.fontSize(16).font(this.fonts.regular)
  .text('Sistema de Gestión Médica', 0, doc.page.height / 2 + 20, {
    align: 'center',
    width: doc.page.width
  });

// Fecha
doc.fontSize(12).font(this.fonts.italic)
  .text(
    moment().format('DD/MM/YYYY HH:mm'),
    0, doc.page.height - 80,
    {
      align: 'center',
      width: doc.page.width
    }
  );
}
_addHeaderMedico(doc, titulo) {
doc.fontSize(18).font(this.fonts.bold).fillColor(this.colors.primary)
.text(titulo, 50, 40, { align: 'left' });
doc.fontSize(10).font(this.fonts.italic).fillColor(this.colors.secondary)
  .text(
    `Generado: ${moment().format('DD/MM/YYYY HH:mm')}`,
    50, 65,
    { align: 'right' }
  );

const y = 80;
doc.strokeColor(this.colors.accent).lineWidth(2)
  .moveTo(50, y).lineTo(doc.page.width - 50, y).stroke();
doc.moveDown(3);
}
_addFooter(doc, pageNumber) {
const text = `Sistema de Gestión Médica | Página ${pageNumber}`;
const fontSize = 8;
const y = doc.page.height - 30;
doc.save();

doc.strokeColor(this.colors.primary)
  .lineWidth(1)
  .moveTo(50, y - 10)
  .lineTo(doc.page.width - 50, y - 10)
  .stroke();

doc.font(this.fonts.italic)
  .fontSize(fontSize)
  .fillColor(this.colors.secondary);

const textWidth = doc.widthOfString(text);
const x = (doc.page.width - textWidth) / 2;

doc.text(text, x, y, {
  lineBreak: false
});

doc.restore();
}
_addChartToPage(doc, chartImage) {
const chartWidth = 500;
const chartHeight = 300;
const x = (doc.page.width - chartWidth) / 2;
const y = doc.y + 20;
try {
  doc.image(chartImage, x, y, {
    width: chartWidth,
    height: chartHeight
  });
  doc.moveDown(16);
} catch (err) {
  console.error('Error agregando gráfica:', err);
}
}
_createFileInfoPromise(fileName, filePath) {
return new Promise((resolve, reject) => {
const stream = fs.createReadStream(filePath);
stream.on('error', err => reject(err));
stream.on('open', () => {
setTimeout(() => {
if (fs.existsSync(filePath)) {
fs.unlink(filePath, () => {});
}
}, this.fileRetentionTime);
    resolve({ 
      fileName, 
      filePath, 
      downloadUrl: `/download/${fileName}` 
    });
  });
});
}
_startCleanupScheduler() {
this._cleanupOldFiles();
setInterval(() => this._cleanupOldFiles(), this.cleanupInterval);
}
_cleanupOldFiles() {
[this.outputDir, this.tempDir].forEach(dir => {
if (!fs.existsSync(dir)) return;
  const now = Date.now();
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    
    if (stats.mtimeMs < now - this.cleanupInterval) {
      fs.unlinkSync(filePath);
      console.log(`Archivo eliminado: ${file}`);
    }
  });
});
}
}
module.exports = new PDFGenerator();
      