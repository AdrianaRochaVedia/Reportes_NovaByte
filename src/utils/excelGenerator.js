const ExcelJS = require('exceljs');
const path = require('path');
const moment = require('moment');
const { REPORTS_OUTPUT_DIR } = require('../config');

class ExcelGenerator {
  constructor() {
    this.outputDir = REPORTS_OUTPUT_DIR;

    this.colors = {
      primary: 'FFE79796',
      primaryLight: 'FFF6DCE3',
      primaryDark: 'FFD27F7E',
      secondary: 'FF64748B',
      success: 'FF10B981',
      warning: 'FFF59E0B',
      danger: 'FFEF4444',
      light: 'FFFCE4EC',
      accent: 'FFF6C8C7',
      border: 'FFE5E7EB',
      graySoft: 'FFF1F5F9',
      white: 'FFFFFFFF'
    };
  }

  async generarDesempenoMedicosExcel(datos, filtro) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema de Gestión Médica';
    workbook.lastModifiedBy = 'Sistema';
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheetResumen = workbook.addWorksheet('Resumen General', {
      properties: { tabColor: { argb: this.colors.primary } }
    });
    this._addResumenSheet(sheetResumen, datos, filtro);

    const sheetDetalle = workbook.addWorksheet('Detalle por Médico', {
      properties: { tabColor: { argb: this.colors.accent } }
    });
    this._addDetalleSheet(sheetDetalle, datos, filtro);

    const sheetDiagnosticos = workbook.addWorksheet('Diagnósticos Frecuentes', {
      properties: { tabColor: { argb: this.colors.warning } }
    });
    this._addDiagnosticosSheet(sheetDiagnosticos, datos);

    const timestamp = Date.now();
    const fileName = `desempeno_medicos_${timestamp}.xlsx`;
    const filePath = path.join(this.outputDir, fileName);

    await workbook.xlsx.writeFile(filePath);

    return {
      fileName,
      filePath,
      downloadUrl: `/download/${fileName}`
    };
  }

  _addResumenSheet(sheet, datos, filtro) {
    let diasPeriodo = null;
    if (filtro?.fecha_desde && filtro?.fecha_hasta) {
      const desde = moment(filtro.fecha_desde).startOf('day');
      const hasta = moment(filtro.fecha_hasta).endOf('day');
      diasPeriodo = hasta.diff(desde, 'days') + 1;
    }

    sheet.mergeCells('A1:F1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'REPORTE DE DESEMPEÑO - MÉDICOS';
    titleCell.font = { size: 18, bold: true, color: { argb: this.colors.primaryDark } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    sheet.mergeCells('A2:F2');
    const infoCell = sheet.getCell('A2');
    infoCell.value = `Generado: ${moment().format('DD/MM/YYYY HH:mm')}`;
    infoCell.font = { size: 10, italic: true };
    infoCell.alignment = { horizontal: 'center' };

    if (filtro?.fecha_desde && filtro?.fecha_hasta) {
      sheet.mergeCells('A3:F3');
      const periodoCell = sheet.getCell('A3');
      periodoCell.value = `Período: ${moment(filtro.fecha_desde).format('DD/MM/YYYY')} - ${moment(filtro.fecha_hasta).format('DD/MM/YYYY')}`;
      periodoCell.font = { size: 10, italic: true };
      periodoCell.alignment = { horizontal: 'center' };
    }

    sheet.addRow([]);

    const headerRow = sheet.addRow([
      'Médico',
      'Especialidad',
      'Total Consultas',
      'Pacientes Únicos',
      'Promedio Consultas/Día',
      'Estado'
    ]);

    headerRow.font = { bold: true, color: { argb: this.colors.white } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: this.colors.primary }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;

    // Datos
    datos.forEach((medico, idx) => {
      const nombre = this._getNombreMedico(medico);
      const especialidad = this._getEspecialidadMedico(medico);
      const totalConsultas = medico.total_consultas || 0;
      const pacientesUnicos = medico.pacientes_unicos || 0;
      const promedio = this._getPromedioConsultas(medico, diasPeriodo);
      const estado = this._getEstadoMedico(medico);

      const row = sheet.addRow([
        nombre,
        especialidad,
        totalConsultas,
        pacientesUnicos,
        promedio,
        estado
      ]);

      if (idx % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: this.colors.light }
        };
      }


      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(5).numFmt = '0.00';

      const estadoCell = row.getCell(6);
      estadoCell.alignment = { horizontal: 'center' };

      if (estado === 'Activo') {
        estadoCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD1FAE5' } 
        };
        estadoCell.font = { bold: true, color: { argb: this.colors.success } };
      } else if (estado === 'Inactivo') {
        estadoCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEE2E2' } 
        };
        estadoCell.font = { bold: true, color: { argb: this.colors.danger } };
      }
    });

    const totalRow = sheet.addRow([
      'TOTALES',
      '',
      datos.reduce((sum, m) => sum + (m.total_consultas || 0), 0),
      '',
      '',
      `${datos.length} médicos`
    ]);

    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: this.colors.primaryLight }
    };

    sheet.columns = [
      { width: 30 },
      { width: 25 },
      { width: 18 },
      { width: 20 },
      { width: 24 },
      { width: 15 }
    ];

 
    const lastRow = sheet.lastRow.number;
    for (let i = 5; i <= lastRow; i++) {
      for (let j = 1; j <= 6; j++) {
        const cell = sheet.getRow(i).getCell(j);
        cell.border = {
          top: { style: 'thin', color: { argb: this.colors.border } },
          left: { style: 'thin', color: { argb: this.colors.border } },
          bottom: { style: 'thin', color: { argb: this.colors.border } },
          right: { style: 'thin', color: { argb: this.colors.border } }
        };
      }
    }
  }

  _addDetalleSheet(sheet, datos, filtro) {
    sheet.mergeCells('A1:E1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'DETALLE POR MÉDICO';
    titleCell.font = { size: 16, bold: true, color: { argb: this.colors.primaryDark } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 25;

    sheet.addRow([]);

    let diasPeriodo = null;
    if (filtro?.fecha_desde && filtro?.fecha_hasta) {
      const desde = moment(filtro.fecha_desde).startOf('day');
      const hasta = moment(filtro.fecha_hasta).endOf('day');
      diasPeriodo = hasta.diff(desde, 'days') + 1;
    }

    datos.forEach((medico) => {
      const nombre = this._getNombreMedico(medico);
      const especialidad = this._getEspecialidadMedico(medico);
      const estado = this._getEstadoMedico(medico);
      const promedio = this._getPromedioConsultas(medico, diasPeriodo);


      sheet.mergeCells(`A${sheet.lastRow.number + 1}:E${sheet.lastRow.number + 1}`);
      const medicoRow = sheet.addRow([nombre]);
      medicoRow.font = { size: 12, bold: true, color: { argb: this.colors.primary } };
      medicoRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: this.colors.primaryLight }
      };
      medicoRow.height = 22;


      sheet.addRow(['Especialidad:', especialidad]);
      sheet.addRow(['Estado:', estado]);
      sheet.addRow(['Total de Consultas:', medico.total_consultas || 0]);
      sheet.addRow(['Pacientes Únicos:', medico.pacientes_unicos || 0]);
      sheet.addRow(['Promedio Consultas/Día:', promedio]);


      if (medico.diagnosticos_frecuentes && medico.diagnosticos_frecuentes.length > 0) {
        sheet.addRow(['']);
        const diagRow = sheet.addRow(['Diagnósticos Más Frecuentes', 'Cantidad']);
        diagRow.font = { bold: true };
        diagRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: this.colors.graySoft }
        };

        medico.diagnosticos_frecuentes.slice(0, 5).forEach(diag => {
          sheet.addRow([diag.descripcion, diag.cantidad]);
        });
      }

      sheet.addRow(['']);
      sheet.addRow(['']);
    });


    sheet.columns = [
      { width: 40 },
      { width: 25 },
      { width: 15 },
      { width: 15 },
      { width: 15 }
    ];
  }

  _addDiagnosticosSheet(sheet, datos) {
    sheet.mergeCells('A1:C1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'DIAGNÓSTICOS MÁS FRECUENTES';
    titleCell.font = { size: 16, bold: true, color: { argb: this.colors.warning } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 25;

    sheet.addRow([]);

    const todosLosDiagnosticos = {};
    datos.forEach(medico => {
      medico.diagnosticos_frecuentes?.forEach(diag => {
        if (todosLosDiagnosticos[diag.descripcion]) {
          todosLosDiagnosticos[diag.descripcion] += diag.cantidad;
        } else {
          todosLosDiagnosticos[diag.descripcion] = diag.cantidad;
        }
      });
    });

    const diagnosticosOrdenados = Object.entries(todosLosDiagnosticos)
      .sort((a, b) => b[1] - a[1]);


    const headerRow = sheet.addRow(['#', 'Diagnóstico', 'Total']);
    headerRow.font = { bold: true, color: { argb: this.colors.white } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: this.colors.warning }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 22;


    diagnosticosOrdenados.forEach(([diagnostico, cantidad], idx) => {
      const row = sheet.addRow([idx + 1, diagnostico, cantidad]);

      if (idx % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFDF6E3' } 
        };
      }

      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(3).alignment = { horizontal: 'center' };
    });

    // Total
    const totalRow = sheet.addRow([
      '',
      'TOTAL',
      diagnosticosOrdenados.reduce((sum, [, cant]) => sum + cant, 0)
    ]);
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFDE68A' }
    };


    sheet.columns = [
      { width: 8 },
      { width: 50 },
      { width: 12 }
    ];


    const lastRow = sheet.lastRow.number;
    for (let i = 4; i <= lastRow; i++) {
      for (let j = 1; j <= 3; j++) {
        const cell = sheet.getRow(i).getCell(j);
        cell.border = {
          top: { style: 'thin', color: { argb: this.colors.warning } },
          left: { style: 'thin', color: { argb: this.colors.warning } },
          bottom: { style: 'thin', color: { argb: this.colors.warning } },
          right: { style: 'thin', color: { argb: this.colors.warning } }
        };
      }
    }
  }


  async generarConsultasExcel(consultas, filtro) {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'Sistema de Gestión Médica';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Consultas', {
      properties: { tabColor: { argb: this.colors.primary } }
    });


    sheet.mergeCells('A1:G1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'REGISTRO DE CONSULTAS';
    titleCell.font = { size: 18, bold: true, color: { argb: this.colors.primaryDark } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;


    sheet.mergeCells('A2:G2');
    const infoCell = sheet.getCell('A2');
    infoCell.value = `Generado: ${moment().format('DD/MM/YYYY HH:mm')}`;
    infoCell.font = { size: 10, italic: true };
    infoCell.alignment = { horizontal: 'center' };

    if (filtro?.fecha_desde && filtro?.fecha_hasta) {
      sheet.mergeCells('A3:G3');
      const periodoCell = sheet.getCell('A3');
      periodoCell.value = `Período: ${moment(filtro.fecha_desde).format('DD/MM/YYYY')} - ${moment(filtro.fecha_hasta).format('DD/MM/YYYY')}`;
      periodoCell.font = { size: 10, italic: true };
      periodoCell.alignment = { horizontal: 'center' };
    }

    sheet.addRow([]);


    const headerRow = sheet.addRow([
      'Fecha',
      'Hora',
      'Paciente',
      'Médico',
      'Especialidad',
      'Motivo',
      'Diagnóstico Principal'
    ]);

    headerRow.font = { bold: true, color: { argb: this.colors.white } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: this.colors.primary }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;

    // Datos
    consultas.forEach((consulta, idx) => {
      const diagnosticoPrincipal = consulta.diagnosticos?.find(d => d.principal);
      const especialidad = this._getEspecialidadMedico(consulta.medico || consulta);

      const row = sheet.addRow([
        moment(consulta.created_at).format('DD/MM/YYYY'),
        moment(consulta.created_at).format('HH:mm'),
        consulta.paciente ? `${consulta.paciente.nombre} ${consulta.paciente.apellidos}` : 'N/A',
        consulta.medico ? `${consulta.medico.nombre} ${consulta.medico.apellidos}` : 'N/A',
        especialidad,
        consulta.motivo || 'N/A',
        diagnosticoPrincipal?.descripcion || 'N/A'
      ]);

      if (idx % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: this.colors.light }
        };
      }

      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'center' };
    });

    // Ajustar anchos
    sheet.columns = [
      { width: 12 },
      { width: 8 },
      { width: 25 },
      { width: 25 },
      { width: 22 },
      { width: 35 },
      { width: 35 }
    ];

    // Bordes
    const lastRow = sheet.lastRow.number;
    for (let i = 5; i <= lastRow; i++) {
      for (let j = 1; j <= 7; j++) {
        const cell = sheet.getRow(i).getCell(j);
        cell.border = {
          top: { style: 'thin', color: { argb: this.colors.border } },
          left: { style: 'thin', color: { argb: this.colors.border } },
          bottom: { style: 'thin', color: { argb: this.colors.border } },
          right: { style: 'thin', color: { argb: this.colors.border } }
        };
      }
    }

    const timestamp = Date.now();
    const fileName = `consultas_${timestamp}.xlsx`;
    const filePath = path.join(this.outputDir, fileName);

    await workbook.xlsx.writeFile(filePath);

    return {
      fileName,
      filePath,
      downloadUrl: `/download/${fileName}`
    };
  }

  // ==========================
  //  PACIENTES EN EXCEL
  // ==========================
  async generarPacientesExcel(pacientes) {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'Sistema de Gestión Médica';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Pacientes', {
      properties: { tabColor: { argb: this.colors.success } }
    });

    // Título
    sheet.mergeCells('A1:F1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'REGISTRO DE PACIENTES';
    titleCell.font = { size: 18, bold: true, color: { argb: this.colors.success } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    sheet.addRow([]);

    // Headers
    const headerRow = sheet.addRow([
      'ID',
      'Nombre Completo',
      'Email',
      'Fecha de Nacimiento',
      'Edad',
      'Estado'
    ]);

    headerRow.font = { bold: true, color: { argb: this.colors.white } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: this.colors.success }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;

    // Datos
    pacientes.forEach((paciente, idx) => {
      const edad = paciente.fecha_nacimiento
        ? moment().diff(moment(paciente.fecha_nacimiento), 'years')
        : 'N/A';

      const row = sheet.addRow([
        paciente.id,
        `${paciente.nombre} ${paciente.apellidos}`,
        paciente.email || 'N/A',
        paciente.fecha_nacimiento ? moment(paciente.fecha_nacimiento).format('DD/MM/YYYY') : 'N/A',
        edad,
        paciente.activo ? 'Activo' : 'Inactivo'
      ]);

      if (idx % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD1FAE5' } // verde suave
        };
      }

      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(6).alignment = { horizontal: 'center' };

      const estadoCell = row.getCell(6);
      if (estadoCell.value === 'Activo') {
        estadoCell.font = { bold: true, color: { argb: this.colors.success } };
      } else {
        estadoCell.font = { bold: true, color: { argb: this.colors.danger } };
      }
    });

    // Ajustar anchos
    sheet.columns = [
      { width: 18 },
      { width: 30 },
      { width: 28 },
      { width: 18 },
      { width: 10 },
      { width: 12 }
    ];

    const timestamp = Date.now();
    const fileName = `pacientes_${timestamp}.xlsx`;
    const filePath = path.join(this.outputDir, fileName);

    await workbook.xlsx.writeFile(filePath);

    return {
      fileName,
      filePath,
      downloadUrl: `/download/${fileName}`
    };
  }

  // ==========================
  //  HELPERS
  // ==========================
  _getNombreMedico(medico) {
    if (!medico) return 'N/A';
    if (medico.nombre_medico) return medico.nombre_medico;
    if (medico.nombre && medico.apellidos) return `${medico.nombre} ${medico.apellidos}`;
    if (medico.medico && medico.medico.nombre && medico.medico.apellidos) {
      return `${medico.medico.nombre} ${medico.medico.apellidos}`;
    }
    return medico.nombre || 'N/A';
  }

  _getEspecialidadMedico(medico) {
    if (!medico) return 'N/A';
    if (medico.especialidad) return medico.especialidad;
    if (medico.especialidad_medico) return medico.especialidad_medico;
    if (medico.medico && medico.medico.especialidad) return medico.medico.especialidad;
    if (medico.detalle && medico.detalle.especialidad) return medico.detalle.especialidad;
    return 'Ginecología y Obstetricia';
  }

  _getEstadoMedico(medico) {
    if (!medico) return 'N/A';
    if (typeof medico.estado === 'string') return medico.estado;
    if (typeof medico.activo === 'boolean') return medico.activo ? 'Activo' : 'Inactivo';
    if (medico.total_consultas != null) {
      return medico.total_consultas > 0 ? 'Activo' : 'Inactivo';
    }
    return 'N/A';
  }

  _getPromedioConsultas(medico, diasPeriodo) {
    if (!medico) return 0;
    if (medico.promedio_consultas_dia != null) {
      return Number(medico.promedio_consultas_dia.toFixed
        ? medico.promedio_consultas_dia.toFixed(2)
        : medico.promedio_consultas_dia);
    }
    if (diasPeriodo && diasPeriodo > 0) {
      const total = medico.total_consultas || 0;
      const prom = total / diasPeriodo;
      return Number(prom.toFixed(2));
    }
    return 0;
  }
}

module.exports = new ExcelGenerator();
