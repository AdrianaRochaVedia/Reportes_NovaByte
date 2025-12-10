const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const moment = require('moment');
require('moment/locale/es');
moment.locale('es');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { REPORTS_OUTPUT_DIR, REPORTS_TEMP_DIR } = require('../config');

class PDFGenerator {
  constructor() {
    this.outputDir = REPORTS_OUTPUT_DIR;
    this.tempDir = REPORTS_TEMP_DIR;

    // PALETA ROSA
    this.colors = {
      primary: '#E79796',
      primaryLight: '#F6DCE3',
      primaryDark: '#D27F7E',
      secondary: '#64748b',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      light: '#FCE4EC',
      border: '#E79796',
      accent: '#F6C8C7',       
      textDark: '#1e293b',
      white: '#ffffff'
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

  _addHeaderMedico(doc, titulo) {
    const headerHeight = 90;
    const logoPath = path.join(__dirname, '../assets/logoo.png');

    doc.rect(0, 0, doc.page.width, headerHeight)
      .fillColor(this.colors.primary).fill();

    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 30, 15, { width: 50, height: 50 });
    }

    doc.fontSize(20).font(this.fonts.bold).fillColor(this.colors.white)
      .text(titulo, 100, 25);

    doc.fontSize(10).font(this.fonts.regular).fillColor(this.colors.white)
      .text(
        `Generado: ${moment().format('DD/MM/YYYY HH:mm')}`,
        doc.page.width - 200,
        30
      );

    doc.fontSize(11).font(this.fonts.italic).fillColor(this.colors.white)
      .text('FEMCARE - Sistema de Gestión Médica', 100, 48);

    doc.strokeColor(this.colors.white).lineWidth(3)
      .moveTo(0, headerHeight).lineTo(doc.page.width, headerHeight).stroke();

    doc.y = headerHeight + 20;
  }

  _addPortadaMedica(doc, titulo) {
    doc.addPage({ size: 'A4', margin: 0 });

    doc.rect(0, 0, doc.page.width, doc.page.height / 2)
      .fillColor(this.colors.primary).fill();

    doc.rect(0, doc.page.height / 2, doc.page.width, doc.page.height / 2)
      .fillColor(this.colors.primaryDark).fill();

    const logoPath = path.join(__dirname, '../assets/logoo.png');
    const logoSize = 250;
    const logoY = 180;
    const logoSpacing = 70;

    if (fs.existsSync(logoPath)) {
      doc.image(
        logoPath,
        (doc.page.width - logoSize) / 2,
        logoY,
        { width: logoSize, height: logoSize }
      );
    }

    const baseTextY = logoY + logoSize + logoSpacing;

    doc.fontSize(42).font(this.fonts.bold).fillColor(this.colors.white)
      .text(titulo, 0, baseTextY, {
        align: 'center',
        width: doc.page.width
      });

    doc.fontSize(24).font(this.fonts.regular).fillColor(this.colors.primaryLight)
      .text('FEMCARE', 0, baseTextY + 50, {
        align: 'center',
        width: doc.page.width
      });

    doc.fontSize(14).font(this.fonts.italic).fillColor(this.colors.white)
      .text('Sistema de Gestión Médica', 0, baseTextY + 90, {
        align: 'center',
        width: doc.page.width
      });

    doc.fontSize(12).font(this.fonts.regular).fillColor(this.colors.white)
      .text(
        moment().format('DD [de] MMMM [de] YYYY - HH:mm'),
        0,
        doc.page.height - 100,
        {
          align: 'center',
          width: doc.page.width
        }
      );
  }

  _addFooter(doc, pageNumber) {
    const prevBottomMargin = doc.page.margins.bottom;
    const prevY = doc.y;

    doc.page.margins.bottom = 0;

    const lineY = doc.page.height - 50;
    const textY = doc.page.height - 40;
    const thirdWidth = doc.page.width / 3;

    doc.save();
    doc.strokeColor(this.colors.primary).lineWidth(2)
      .moveTo(40, lineY)
      .lineTo(doc.page.width - 40, lineY)
      .stroke();

    doc.fontSize(10).font(this.fonts.regular).fillColor(this.colors.secondary)
      .text('FEMCARE © 2025', 40, textY, {
        width: thirdWidth - 40,
        align: 'left',
        lineBreak: false
      });

    doc.fontSize(11).font(this.fonts.bold).fillColor(this.colors.primary)
      .text(`Página ${pageNumber}`, thirdWidth, textY, {
        width: thirdWidth,
        align: 'center',
        lineBreak: false
      });

    doc.fontSize(9).font(this.fonts.regular).fillColor(this.colors.secondary)
      .text('Confidencial', thirdWidth * 2, textY, {
        width: thirdWidth - 40,
        align: 'right',
        lineBreak: false
      });

    doc.restore();

    doc.page.margins.bottom = prevBottomMargin;
    doc.y = prevY;
  }

  _createModernTable(doc, headers, rows, columnWidths, onNewPage) {
    const rowHeight = 35;
    const headerHeight = 40;
    let y = doc.y;
    const footerHeight = 80;

    const totalWidth = Object.values(columnWidths).reduce((sum, w) => sum + w, 0);
    const startX = (doc.page.width - totalWidth) / 2;

    const drawHeader = () => {
      doc.rect(startX, y, totalWidth, headerHeight)
        .fillColor(this.colors.primary).fill();

      doc.rect(startX, y + headerHeight, totalWidth, 3)
        .fillColor(this.colors.accent).fill();

      let currentX = startX;
      doc.font(this.fonts.bold).fontSize(11).fillColor(this.colors.white);

      Object.entries(headers).forEach(([key, title]) => {
        doc.text(
          title.toUpperCase(),
          currentX + 10,
          y + 13,
          {
            width: columnWidths[key] - 20,
            align: 'left'
          }
        );
        currentX += columnWidths[key];
      });

      y += headerHeight + 3;
    };

    drawHeader();

    rows.forEach((row, idx) => {
      if (y + rowHeight + footerHeight > doc.page.height - 50) {
        onNewPage();
        y = doc.y;
        drawHeader();
      }

      const bgColor = idx % 2 === 0 ? this.colors.white : this.colors.light;
      doc.rect(startX, y, totalWidth, rowHeight)
        .fillColor(bgColor).fill();

      doc.strokeColor(this.colors.primaryLight).lineWidth(0.5)
        .moveTo(startX, y + rowHeight)
        .lineTo(startX + totalWidth, y + rowHeight)
        .stroke();

      let currentX = startX;
      doc.font(this.fonts.regular).fontSize(9).fillColor(this.colors.textDark);

      Object.entries(headers).forEach(([key]) => {
        const cellValue = row[key] || 'N/A';
        const cellColor = row[`${key}_color`] || this.colors.textDark;

        doc.fillColor(cellColor).text(
          cellValue.toString(),
          currentX + 10,
          y + 11,
          {
            width: columnWidths[key] - 20,
            align: 'left'
          }
        );
        currentX += columnWidths[key];
      });

      y += rowHeight;
    });

    doc.y = y + 10;
  }

  _addModernSection(doc, titulo, contenido, onNewPage = () => {}) {
    const boxPadding = 12;
    const boxX = 40;
    const boxWidth = doc.page.width - 80;

    const textHeight = doc.heightOfString(contenido, {
      width: boxWidth - boxPadding * 2,
      align: 'left'
    });

    const boxHeight = textHeight + boxPadding * 2;
    const titleHeight = 18;
    const neededHeight = titleHeight + 6 + boxHeight + 12;

    const bottomLimit = doc.page.height - 130;

    if (doc.y + neededHeight > bottomLimit) {
      onNewPage();
    }

    doc.fontSize(11)
      .font(this.fonts.bold)
      .fillColor(this.colors.primary)
      .text(titulo, boxX, doc.y);

    const titleBottomY = doc.y + 4;
    const boxY = titleBottomY + 6;

    doc.rect(boxX, boxY, boxWidth, boxHeight)
      .lineWidth(1.5)
      .strokeColor(this.colors.border)
      .fillColor(this.colors.white)
      .fillAndStroke();

    doc.fontSize(10)
      .font(this.fonts.regular)
      .fillColor(this.colors.textDark)
      .text(contenido, boxX + boxPadding, boxY + boxPadding, {
        width: boxWidth - boxPadding * 2,
        align: 'left'
      });

    doc.y = boxY + boxHeight + 12;
  }

  _addEstadisticasCards(doc, stats) {
    const cards = [
      { label: 'Médicos Activos', value: stats.total_medicos_activos, icon: '', color: this.colors.primary },
      { label: 'Pacientes', value: stats.total_pacientes, icon: '', color: this.colors.accent },
      { label: 'Consultas Totales', value: stats.total_consultas, icon: '', color: this.colors.success },
      { label: 'Consultas Mes Actual', value: stats.consultas_mes_actual, icon: '', color: this.colors.warning },
      { label: 'Citas Programadas', value: stats.citas_programadas, icon: '', color: this.colors.secondary },
      { label: 'Citas Completadas', value: stats.citas_completadas, icon: '', color: this.colors.success }
    ];

    const cardWidth = 160;
    const cardHeight = 100;
    const spacing = 25;
    const totalRowWidth = cardWidth * 3 + spacing * 2;
    const startX = (doc.page.width - totalRowWidth) / 2;

    let currentX = startX;
    let currentY = doc.y;

    cards.forEach((card, idx) => {
      if (idx > 0 && idx % 3 === 0) {
        currentX = startX;
        currentY += cardHeight + spacing;
      }

      doc.rect(currentX + 3, currentY + 3, cardWidth, cardHeight)
        .fillColor('#d1d5db').fill();

      doc.rect(currentX, currentY, cardWidth, cardHeight)
        .fillColor(card.color).fill();

      doc.fontSize(32).font(this.fonts.bold).fillColor(this.colors.white)
        .text(card.value.toString(), currentX + 15, currentY + 20);

      doc.fontSize(10).font(this.fonts.regular).fillColor(this.colors.white)
        .text(card.label, currentX + 15, currentY + 65, {
          width: cardWidth - 30
        });

      doc.save();
      doc.circle(currentX + cardWidth - 25, currentY + 25, 15)
        .lineWidth(1)
        .fillColor(this.colors.white)
        .fill();
      doc.restore();

      currentX += cardWidth + spacing;
    });

    doc.y = currentY + cardHeight + spacing + 10;
  }

  // HISTORIA CLÍNICA
  async generarHistoriaClinicaPDF(datos, filtro) {
    const timestamp = Date.now();
    const fileName = `historia_clinica_${datos.paciente.nombre}_${timestamp}.pdf`;
    const filePath = path.join(this.outputDir, fileName);

    const doc = new PDFDocument({
      autoFirstPage: false,
      margins: { top: 80, bottom: 80, left: 50, right: 50 }
    });

    doc.pipe(fs.createWriteStream(filePath));
    let pageNumber = 1;

    this._addPortadaMedica(doc, 'Historia Clínica');

    doc.addPage();
    this._addHeaderMedico(doc, 'Historia Clínica Completa');
    this._addDatosPacienteModerno(doc, datos.paciente);
    this._addFooter(doc, pageNumber++);

    if (datos.antecedentes?.length > 0 || datos.alergias?.length > 0) {
      doc.addPage();
      this._addHeaderMedico(doc, 'Historia Clínica Completa');

      if (datos.antecedentes?.length > 0) {
        this._addAntecedentesModerno(doc, datos.antecedentes);
      }

      if (datos.alergias?.length > 0) {
        this._addAlergiasModerno(doc, datos.alergias);
      }

      this._addFooter(doc, pageNumber++);
    }

    if (datos.consultas && datos.consultas.length > 0) {
      for (const consulta of datos.consultas) {
        const onNewPage = () => {
          this._addFooter(doc, pageNumber++);
          doc.addPage();
          this._addHeaderMedico(doc, 'Historia Clínica Completa');
        };

        doc.addPage();
        this._addHeaderMedico(doc, 'Historia Clínica Completa');
        this._addConsultaDetalleModerno(doc, consulta, onNewPage);
        this._addFooter(doc, pageNumber++);
      }
    }

    doc.end();
    return this._createFileInfoPromise(fileName, filePath);
  }

  _addDatosPacienteModerno(doc, paciente) {
    const cardY = doc.y;
    const cardHeight = 160;
    const cardWidth = doc.page.width - 80;

    doc.rect(43, cardY + 3, cardWidth, cardHeight)
      .fillColor('#fff').fill();

    doc.rect(40, cardY, cardWidth, cardHeight)
      .lineWidth(3)
      .strokeColor(this.colors.primary)
      .fillColor(this.colors.white)
      .fillAndStroke();

    doc.rect(40, cardY, cardWidth, 35)
      .fillColor(this.colors.primaryLight).fill();

    doc.fontSize(14).font(this.fonts.bold).fillColor(this.colors.primaryDark)
      .text('DATOS DEL PACIENTE', 55, cardY + 12);

    let currentY = cardY + 50;
    const leftCol = 60;
    const rightCol = 320;

    doc.fontSize(10).font(this.fonts.bold).fillColor(this.colors.primary)
      .text('Nombre completo', leftCol, currentY);
    doc.font(this.fonts.regular).fillColor(this.colors.textDark)
      .text(`${paciente.nombre} ${paciente.apellidos}`, leftCol, currentY + 15);

    doc.font(this.fonts.bold).fillColor(this.colors.primary)
      .text('Fecha de nacimiento', rightCol, currentY);
    doc.font(this.fonts.regular).fillColor(this.colors.textDark)
      .text(
        paciente.fecha_nacimiento
          ? moment(paciente.fecha_nacimiento).format('DD/MM/YYYY')
          : 'No registrada',
        rightCol, currentY + 15
      );

    currentY += 45;
    doc.font(this.fonts.bold).fillColor(this.colors.primary)
      .text('Email', leftCol, currentY);
    doc.font(this.fonts.regular).fillColor(this.colors.textDark)
      .text(paciente.email || 'No registrado', leftCol, currentY + 15);

    doc.font(this.fonts.bold).fillColor(this.colors.primary)
      .text('Edad', rightCol, currentY);
    doc.font(this.fonts.regular).fillColor(this.colors.textDark)
      .text(
        paciente.edad ? `${paciente.edad} años` : 'No calculada',
        rightCol, currentY + 15
      );

    doc.y = cardY + cardHeight + 20;
  }

  _addAntecedentesModerno(doc, antecedentes) {
    doc.fontSize(14).font(this.fonts.bold).fillColor(this.colors.primary)
      .text('Antecedentes Médicos', 40);
    doc.moveDown(0.5);

    antecedentes.forEach((ant, idx) => {
      const boxY = doc.y;
      const boxHeight = 60;

      doc.rect(40, boxY, doc.page.width - 80, boxHeight)
        .fillColor(idx % 2 === 0 ? this.colors.light : this.colors.white)
        .fill();

      doc.fontSize(11).font(this.fonts.bold).fillColor(this.colors.primaryDark)
        .text(`${idx + 1}. ${ant.tipo}`, 55, boxY + 12);

      doc.fontSize(9).font(this.fonts.regular).fillColor(this.colors.textDark)
        .text(ant.descripcion, 55, boxY + 30, {
          width: doc.page.width - 110
        });

      doc.y = boxY + boxHeight + 5;
    });

    doc.moveDown(1);
  }

  _addAlergiasModerno(doc, alergias) {
    doc.fontSize(14).font(this.fonts.bold).fillColor(this.colors.danger)
      .text('Alergias', 40);
    doc.moveDown(0.5);

    const boxY = doc.y;
    const itemHeight = 35;
    const totalHeight = alergias.length * itemHeight + 20;

    doc.rect(40, boxY, doc.page.width - 80, totalHeight)
      .fillColor('#fee2e2').fill();

    doc.rect(40, boxY, doc.page.width - 80, totalHeight)
      .lineWidth(2)
      .strokeColor(this.colors.danger)
      .stroke();

    let currentY = boxY + 15;
    alergias.forEach((alergia) => {
      doc.fontSize(11).font(this.fonts.bold).fillColor(this.colors.danger)
        .text(`• ${alergia.sustancia}`, 60, currentY);

      doc.fontSize(9).font(this.fonts.regular).fillColor(this.colors.textDark)
        .text(
          `Severidad: ${alergia.severidad || 'No especificada'}`,
          75, currentY + 15
        );

      currentY += itemHeight;
    });

    doc.y = boxY + totalHeight + 15;
  }

  _addConsultaDetalleModerno(doc, consulta, onNewPage = () => {}) {
    const bottomLimit = doc.page.height - 130;

    const ensureSpace = (extraHeight = 80) => {
      if (doc.y + extraHeight > bottomLimit) {
        onNewPage();
      }
    };

    ensureSpace(60);
    const headerY = doc.y;
    doc.rect(40, headerY, doc.page.width - 80, 40)
      .fillColor(this.colors.primary).fill();

    doc.fontSize(13).font(this.fonts.bold).fillColor(this.colors.white)
      .text(
        `Consulta - ${moment(consulta.created_at).format('DD/MM/YYYY HH:mm')}`,
        55, headerY + 10
      );

    if (consulta.medico) {
      doc.fontSize(9).font(this.fonts.regular)
        .text(
          `Dr(a). ${consulta.medico.nombre} ${consulta.medico.apellidos}`,
          55, headerY + 25
        );
    }

    doc.y = headerY + 50;

    if (consulta.motivo) {
      ensureSpace(110);
      this._addModernSection(doc, 'MOTIVO DE CONSULTA', consulta.motivo, onNewPage);
    }

    if (consulta.signosVitales) {
      this._addSignosVitalesModerno(doc, consulta.signosVitales, onNewPage);
    }

    if (consulta.anamnesis) {
      ensureSpace(110);
      this._addModernSection(doc, 'ANAMNESIS', consulta.anamnesis, onNewPage);
    }

    if (consulta.examen_fisico) {
      ensureSpace(110);
      this._addModernSection(doc, 'EXAMEN FÍSICO', consulta.examen_fisico, onNewPage);
    }

    if (consulta.diagnosticos && consulta.diagnosticos.length > 0) {
      this._addDiagnosticosModerno(doc, consulta.diagnosticos, onNewPage);
    }

    if (consulta.plan) {
      this._addModernSection(doc, 'PLAN', consulta.plan, onNewPage);
    }
  }

  _addSignosVitalesModerno(doc, signos, onNewPage = () => {}) {
    const bottomLimit = doc.page.height - 130;

    const cardWidth = 160;
    const cardHeight = 60;
    const spacing = 20;
    const rows = 2; // 6 items → 2 filas de 3
    const estimatedHeight = 20 + rows * (cardHeight + spacing);

    if (doc.y + estimatedHeight > bottomLimit) {
      onNewPage();
    }

    doc.fontSize(12).font(this.fonts.bold).fillColor(this.colors.primaryDark)
      .text('Signos Vitales', 40);
    doc.moveDown(0.3);

    const items = [
      {
        label: 'Presión Arterial',
        value: signos.presion_sistolica && signos.presion_diastolica
          ? `${signos.presion_sistolica}/${signos.presion_diastolica} mmHg`
          : 'N/A',
        icon: ''
      },
      { label: 'Frecuencia Cardíaca', value: signos.frecuencia_cardiaca ? `${signos.frecuencia_cardiaca} lpm` : 'N/A', icon: '' },
      { label: 'Temperatura', value: signos.temperatura ? `${signos.temperatura} °C` : 'N/A', icon: '' },
      { label: 'Saturación O2', value: signos.saturacion_oxigeno ? `${signos.saturacion_oxigeno}%` : 'N/A', icon: '' },
      { label: 'Peso', value: signos.peso_kg ? `${signos.peso_kg} kg` : 'N/A', icon: '' },
      { label: 'Talla', value: signos.talla_cm ? `${signos.talla_cm} cm` : 'N/A', icon: '' }
    ];

    let currentX = 40;
    let currentY = doc.y;

    items.forEach((item, idx) => {
      if (idx > 0 && idx % 3 === 0) {
        currentX = 40;
        currentY += cardHeight + spacing;
      }

      doc.rect(currentX, currentY, cardWidth, cardHeight)
        .fillColor(this.colors.light).fill();

      doc.rect(currentX, currentY, cardWidth, cardHeight)
        .lineWidth(1.5)
        .strokeColor(this.colors.border)
        .stroke();

      doc.fontSize(9).font(this.fonts.regular).fillColor(this.colors.secondary)
        .text(item.label, currentX + 10, currentY + 10);

      doc.fontSize(14).font(this.fonts.bold).fillColor(this.colors.primary)
        .text(item.value, currentX + 10, currentY + 28);

      currentX += cardWidth + spacing;
    });

    doc.y = currentY + cardHeight + 20;
    doc.moveDown(1);
  }

  _addDiagnosticosModerno(doc, diagnosticos, onNewPage = () => {}) {
    const bottomLimit = doc.page.height - 130;

    doc.fontSize(12).font(this.fonts.bold).fillColor(this.colors.primary)
      .text('Diagnósticos', 40);
    doc.moveDown(0.5);

    diagnosticos.forEach((diag) => {
      const boxHeight = 40;
      if (doc.y + boxHeight + 20 > bottomLimit) {
        onNewPage();
      }

      const boxY = doc.y;
      const isPrincipal = diag.principal;

      doc.rect(40, boxY, doc.page.width - 80, boxHeight)
        .fillColor(isPrincipal ? this.colors.primaryLight : this.colors.white)
        .fill();

      if (isPrincipal) {
        doc.rect(40, boxY, doc.page.width - 80, boxHeight)
          .lineWidth(2)
          .strokeColor(this.colors.accent)
          .stroke();
      }

      const prefix = isPrincipal ? '' : '';
      doc.fontSize(11).font(this.fonts.bold)
        .fillColor(isPrincipal ? this.colors.primaryDark : this.colors.textDark)
        .text(`${prefix} ${diag.descripcion}`, 55, boxY + 12);

      if (diag.codigo) {
        doc.fontSize(9).font(this.fonts.italic).fillColor(this.colors.secondary)
          .text(`Código: ${diag.codigo}`, 55, boxY + 28);
      }

      doc.y = boxY + boxHeight + 5;
    });

    doc.moveDown(1);
  }

  // AGENDA MÉDICA
  async generarAgendaMedicoPDF(datos, filtro) {
    const timestamp = Date.now();
    const fileName = `agenda_medico_${timestamp}.pdf`;
    const filePath = path.join(this.outputDir, fileName);

    const doc = new PDFDocument({ autoFirstPage: false });
    doc.pipe(fs.createWriteStream(filePath));
    let pageNumber = 1;

    this._addPortadaMedica(doc, 'Agenda Médica');

    doc.addPage();
    this._addHeaderMedico(doc, 'Agenda Médica');

    const cardY = doc.y;
    doc.rect(40, cardY, doc.page.width - 80, 70)
      .fillColor(this.colors.primaryLight).fill();

    doc.fontSize(16).font(this.fonts.bold).fillColor(this.colors.primaryDark)
      .text(`Dr(a). ${datos.medico.nombre} ${datos.medico.apellidos}`, 55, cardY + 15);

    doc.fontSize(11).font(this.fonts.regular).fillColor(this.colors.textDark)
      .text(datos.medico.especialidad || '', 55, cardY + 35);

    doc.fontSize(10).font(this.fonts.italic).fillColor(this.colors.secondary)
      .text(
        `Período: ${moment(filtro.fecha_desde).format('DD/MM/YYYY')} - ${moment(filtro.fecha_hasta).format('DD/MM/YYYY')}`,
        55, cardY + 50
      );

    doc.y = cardY + 90;

    const headers = {
      fecha: 'Fecha',
      hora: 'Hora',
      paciente: 'Paciente',
      tipo: 'Tipo',
      estado: 'Estado'
    };

    const columnWidths = {
      fecha: 90,
      hora: 70,
      paciente: 160,
      tipo: 90,
      estado: 80
    };

    const rows = datos.citas.map(cita => {
      const estadoColors = {
        programada: this.colors.warning,
        completada: this.colors.success,
        cancelada: this.colors.danger
      };

      return {
        fecha: moment(cita.fecha_hora).format('DD/MM/YYYY'),
        hora: moment(cita.fecha_hora).format('HH:mm'),
        paciente: `${cita.paciente?.nombre} ${cita.paciente?.apellidos}`,
        tipo: cita.tipo_cita || 'N/A',
        estado: cita.estado,
        estado_color: estadoColors[cita.estado] || this.colors.textDark
      };
    });

    this._createModernTable(doc, headers, rows, columnWidths, () => {
      this._addFooter(doc, pageNumber++);
      doc.addPage();
      this._addHeaderMedico(doc, 'Agenda Médica');
    });

    this._addFooter(doc, pageNumber++);

    try {
      const chartImage = await this._generateCitasPorEstadoChart(datos.citas);
      doc.addPage();
      this._addHeaderMedico(doc, 'Agenda Médica');
      doc.fontSize(14).font(this.fonts.bold).fillColor(this.colors.primary)
        .text('Distribución de Citas por Estado', 40);
      doc.moveDown(1);
      this._addChartToPage(doc, chartImage);
      this._addFooter(doc, pageNumber++);
    } catch (err) {
      console.error('Error generando gráfica de citas:', err);
    }

    doc.end();
    return this._createFileInfoPromise(fileName, filePath);
  }

  async _generateCitasPorEstadoChart(citas) {
    const estadoCounts = citas.reduce((acc, cita) => {
      acc[cita.estado] = (acc[cita.estado] || 0) + 1;
      return acc;
    }, {});

    const width = 600;
    const height = 400;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour: '#ffffff'  
    });

    const configuration = {
      type: 'pie',
      data: {
        labels: Object.keys(estadoCounts),
        datasets: [{
          data: Object.values(estadoCounts),
          backgroundColor: [this.colors.warning, this.colors.success, this.colors.danger],
          borderColor: this.colors.white,
          borderWidth: 3
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

  // DESEMPEÑO MÉDICOS
  async generarDesempenoMedicosPDF(datos, filtro) {
    const timestamp = Date.now();
    const fileName = `desempeno_medicos_${timestamp}.pdf`;
    const filePath = path.join(this.outputDir, fileName);

    const doc = new PDFDocument({ autoFirstPage: false });
    doc.pipe(fs.createWriteStream(filePath));
    let pageNumber = 1;

    this._addPortadaMedica(doc, 'Desempeño Médicos');

    doc.addPage();
    this._addHeaderMedico(doc, 'Reporte de Desempeño - Médicos');

    if (filtro.fecha_desde && filtro.fecha_hasta) {
      const cardY = doc.y;
      doc.rect(40, cardY, doc.page.width - 80, 40)
        .fillColor(this.colors.light).fill();

      doc.fontSize(11).font(this.fonts.bold).fillColor(this.colors.primary)
        .text('Período de análisis:', 55, cardY + 12);

      doc.fontSize(10).font(this.fonts.regular).fillColor(this.colors.textDark)
        .text(
          `${moment(filtro.fecha_desde).format('DD/MM/YYYY')} - ${moment(filtro.fecha_hasta).format('DD/MM/YYYY')}`,
          55, cardY + 28
        );

      doc.y = cardY + 55;
    }

    const headers = {
      medico: 'Médico',
      consultas: 'Consultas',
      pacientes: 'Pacientes',
      promedio: 'Promedio/día'
    };

    const columnWidths = {
      medico: 180,
      consultas: 100,
      pacientes: 100,
      promedio: 110
    };

    const rows = datos.map(medico => ({
      medico: medico.nombre_medico,
      consultas: medico.total_consultas.toString(),
      pacientes: medico.pacientes_unicos.toString(),
      promedio: medico.promedio_consultas_dia.toFixed(2)
    }));

    this._createModernTable(doc, headers, rows, columnWidths, () => {
      this._addFooter(doc, pageNumber++);
      doc.addPage();
      this._addHeaderMedico(doc, 'Reporte de Desempeño - Médicos');
    });

    this._addFooter(doc, pageNumber++);

    if (datos.length > 1) {
      try {
        const chartImage = await this._generateDesempenoChart(datos);
        doc.addPage();
        this._addHeaderMedico(doc, 'Reporte de Desempeño - Médicos');
        doc.fontSize(14).font(this.fonts.bold).fillColor(this.colors.primary)
          .text('Comparativa de Consultas por Médico', 40);
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

  async _generateDesempenoChart(datos) {
    const width = 600;
    const height = 400;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour: '#ffffff'});

    const configuration = {
      type: 'bar',
      data: {
        labels: datos.map(d => d.nombre_medico.split(' ')[0]),
        datasets: [{
          label: 'Total de Consultas',
          data: datos.map(d => d.total_consultas),
          backgroundColor: this.colors.primary,
          borderColor: this.colors.primaryDark,
          borderWidth: 2
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

  // RESUMEN DE CONSULTAS
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
      const cardY = doc.y;
      doc.rect(40, cardY, doc.page.width - 80, 40)
        .fillColor(this.colors.light).fill();

      doc.fontSize(11).font(this.fonts.bold).fillColor(this.colors.primary)
        .text('Período:', 55, cardY + 12);

      doc.fontSize(10).font(this.fonts.regular).fillColor(this.colors.textDark)
        .text(
          `${moment(filtro.fecha_desde).format('DD/MM/YYYY')} - ${moment(filtro.fecha_hasta).format('DD/MM/YYYY')}`,
          55, cardY + 28
        );

      doc.y = cardY + 55;
    }

    consultas.forEach((consulta, idx) => {
      if (doc.y > doc.page.height - 150) {
        this._addFooter(doc, pageNumber++);
        doc.addPage();
        this._addHeaderMedico(doc, 'Resumen de Consultas');
      }

      this._addConsultaResumenModerno(doc, consulta, idx);
    });

    this._addFooter(doc, pageNumber++);

    doc.end();
    return this._createFileInfoPromise(fileName, filePath);
  }

  _addConsultaResumenModerno(doc, consulta, idx) {
    const boxY = doc.y;
    const boxHeight = 95;

    doc.rect(43, boxY + 3, doc.page.width - 86, boxHeight)
      .fillColor('#d1d5db').fill();

    doc.rect(40, boxY, doc.page.width - 80, boxHeight)
      .lineWidth(2)
      .strokeColor(this.colors.border)
      .fillColor(this.colors.white)
      .fillAndStroke();

    doc.rect(40, boxY, 8, boxHeight)
      .fillColor(this.colors.accent).fill();

    let currentY = boxY + 12;

    doc.fontSize(13).font(this.fonts.bold).fillColor(this.colors.primary)
      .text(
        ` ${moment(consulta.created_at).format('DD/MM/YYYY HH:mm')}`,
        60, currentY
      );

    currentY += 22;

    if (consulta.paciente) {
      doc.fontSize(10).font(this.fonts.regular).fillColor(this.colors.textDark)
        .text(
          `👤 Paciente: ${consulta.paciente.nombre} ${consulta.paciente.apellidos}`,
          60, currentY
        );
      currentY += 18;
    }

    if (consulta.medico) {
      doc.text(
        `Médico: Dr(a). ${consulta.medico.nombre} ${consulta.medico.apellidos}`,
        60, currentY
      );
      currentY += 18;
    }

    if (consulta.motivo) {
      doc.fontSize(9).font(this.fonts.italic).fillColor(this.colors.secondary)
        .text(
          ` ${consulta.motivo.substring(0, 65)}${consulta.motivo.length > 65 ? '...' : ''}`,
          60, currentY,
          { width: doc.page.width - 120 }
        );
    }

    doc.y = boxY + boxHeight + 12;
  }

  async generarDashboardEstadisticasPDF(estadisticas, filtro) {
    const timestamp = Date.now();
    const fileName = `dashboard_estadisticas_${timestamp}.pdf`;
    const filePath = path.join(this.outputDir, fileName);
    const doc = new PDFDocument({ autoFirstPage: false });
    doc.pipe(fs.createWriteStream(filePath));

    let pageNumber = 1;

    this._addPortadaMedica(doc, 'Dashboard Estadísticas');

    doc.addPage();
    this._addHeaderMedico(doc, 'Dashboard - Estadísticas');

    if (filtro.fecha_desde && filtro.fecha_hasta) {
      const cardY = doc.y;
      doc.rect(40, cardY, doc.page.width - 80, 40)
        .fillColor(this.colors.light).fill();

      doc.fontSize(11).font(this.fonts.bold).fillColor(this.colors.primary)
        .text('Período de análisis:', 55, cardY + 12);

      doc.fontSize(10).font(this.fonts.regular).fillColor(this.colors.textDark)
        .text(
          `${moment(filtro.fecha_desde).format('DD/MM/YYYY')} - ${moment(filtro.fecha_hasta).format('DD/MM/YYYY')}`,
          55, cardY + 28
        );

      doc.y = cardY + 55;
    }

    this._addEstadisticasCards(doc, estadisticas);
    this._addFooter(doc, pageNumber++);

    try {
      const chartImage = await this._generateEstadisticasGeneralesChart(estadisticas);
      doc.addPage();
      this._addHeaderMedico(doc, 'Dashboard - Estadísticas Generales');

      doc.fontSize(14).font(this.fonts.bold).fillColor(this.colors.primary)
        .text('Resumen gráfico de estadísticas', 40);

      doc.moveDown(1);
      this._addChartToPage(doc, chartImage);

      this._addFooter(doc, pageNumber++);
    } catch (err) {
      console.error('Error generando gráfica de estadísticas generales:', err);
    }

    doc.end();
    return this._createFileInfoPromise(fileName, filePath);
  }

  async _generateEstadisticasGeneralesChart(estadisticas) {
    const width = 600;
    const height = 400;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour: '#ffffff' });

    const labels = [
      'Médicos activos',
      'Pacientes',
      'Consultas totales',
      'Consultas mes',
      'Citas programadas',
      'Citas completadas'
    ];

    const data = [
      estadisticas.total_medicos_activos || 0,
      estadisticas.total_pacientes || 0,
      estadisticas.total_consultas || 0,
      estadisticas.consultas_mes_actual || 0,
      estadisticas.citas_programadas || 0,
      estadisticas.citas_completadas || 0
    ];

    const configuration = {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Cantidad',
          data,
          backgroundColor: [
            this.colors.primary,
            this.colors.accent,
            this.colors.success,
            this.colors.warning,
            this.colors.secondary,
            this.colors.success
          ],
          borderColor: this.colors.primaryDark,
          borderWidth: 2
        }]
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Resumen de estadísticas generales',
            font: { size: 16 }
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 }
          }
        }
      }
    };

    return await chartJSNodeCanvas.renderToBuffer(configuration);
  }

  // HELPERS
  _addChartToPage(doc, chartImage) {
    const chartWidth = 500;
    const chartHeight = 300;
    const x = (doc.page.width - chartWidth) / 2;
    const y = doc.y + 20;

    try {
      doc.rect(x + 5, y + 5, chartWidth, chartHeight)
        .fillColor('#d1d5db').fill();

      doc.image(chartImage, x, y, {
        width: chartWidth,
        height: chartHeight
      });

      doc.moveDown(18);
    } catch (err) {
      console.error('Error agregando gráfica:', err);
    }
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
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour: '#ffffff' });

    const configuration = {
      type: 'line',
      data: {
        labels: data.map(d => d.fecha),
        datasets: [
          {
            label: 'PA Sistólica',
            data: data.map(d => d.pa_sistolica),
            borderColor: this.colors.danger,
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            tension: 0.4,
            borderWidth: 2
          },
          {
            label: 'PA Diastólica',
            data: data.map(d => d.pa_diastolica),
            borderColor: this.colors.warning,
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            tension: 0.4,
            borderWidth: 2
          },
          {
            label: 'FC (lpm)',
            data: data.map(d => d.fc),
            borderColor: this.colors.primary,
            backgroundColor: 'rgba(233, 30, 99, 0.1)',
            tension: 0.4,
            borderWidth: 2
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

  _addSection(doc, titulo, contenido) {
    doc.fontSize(11).font(this.fonts.bold).fillColor(this.colors.primary)
      .text(titulo, 50);
    doc.fontSize(10).font(this.fonts.regular).fillColor(this.colors.textDark)
      .text(contenido, 70, doc.y, { width: doc.page.width - 140 });
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
