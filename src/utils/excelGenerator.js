const ExcelJS = require('exceljs');
const path = require('path');
const moment = require('moment');
const { REPORTS_OUTPUT_DIR } = require('../config');

class ExcelGenerator {
  constructor() {
    this.outputDir = REPORTS_OUTPUT_DIR;
  }

  // ============================================
  // DESEMPEÑO DE MÉDICOS EN EXCEL
  // ============================================
  
  async generarDesempenoMedicosExcel(datos, filtro) {
    const workbook = new ExcelJS.Workbook();
    
    // Metadatos
    workbook.creator = 'Sistema de Gestión Médica';
    workbook.lastModifiedBy = 'Sistema';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Hoja 1: Resumen General
    const sheetResumen = workbook.addWorksheet('Resumen General', {
      properties: { tabColor: { argb: 'FF2563EB' } }
    });

    this._addResumenSheet(sheetResumen, datos, filtro);

    // Hoja 2: Detalle por Médico
    const sheetDetalle = workbook.addWorksheet('Detalle por Médico', {
      properties: { tabColor: { argb: 'FF10B981' } }
    });

    this._addDetalleSheet(sheetDetalle, datos);

    // Hoja 3: Diagnósticos Frecuentes
    const sheetDiagnosticos = workbook.addWorksheet('Diagnósticos Frecuentes', {
      properties: { tabColor: { argb: 'FFF59E0B' } }
    });

    this._addDiagnosticosSheet(sheetDiagnosticos, datos);

    // Guardar archivo
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
    // Título
    sheet.mergeCells('A1:F1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'REPORTE DE DESEMPEÑO - MÉDICOS';
    titleCell.font = { size: 18, bold: true, color: { argb: 'FF2563EB' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    // Información del reporte
    sheet.mergeCells('A2:F2');
    const infoCell = sheet.getCell('A2');
    infoCell.value = `Generado: ${moment().format('DD/MM/YYYY HH:mm')}`;
    infoCell.font = { size: 10, italic: true };
    infoCell.alignment = { horizontal: 'center' };

    if (filtro.fecha_desde && filtro.fecha_hasta) {
      sheet.mergeCells('A3:F3');
      const periodoCell = sheet.getCell('A3');
      periodoCell.value = `Período: ${moment(filtro.fecha_desde).format('DD/MM/YYYY')} - ${moment(filtro.fecha_hasta).format('DD/MM/YYYY')}`;
      periodoCell.font = { size: 10, italic: true };
      periodoCell.alignment = { horizontal: 'center' };
    }

    sheet.addRow([]);

    // Headers de tabla
    const headerRow = sheet.addRow([
      'Médico',
      'Especialidad',
      'Total Consultas',
      'Pacientes Únicos',
      'Promedio Consultas/Día',
      'Estado'
    ]);

    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;

    // Datos
    datos.forEach((medico, idx) => {
      const row = sheet.addRow([
        medico.nombre_medico,
        'N/A', // Especialidad (agregar si está disponible)
        medico.total_consultas,
        medico.pacientes_unicos,
        medico.promedio_consultas_dia.toFixed(2),
        medico.total_consultas > 0 ? 'Activo' : 'Inactivo'
      ]);

      // Alternar colores de fila
      if (idx % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' }
        };
      }

      // Centrar datos numéricos
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(6).alignment = { horizontal: 'center' };
    });

    // Fila de totales
    const totalRow = sheet.addRow([
      'TOTALES',
      '',
      datos.reduce((sum, m) => sum + m.total_consultas, 0),
      '', // No suma pacientes únicos (puede ser duplicado)
      '',
      `${datos.length} médicos`
    ]);

    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E7FF' }
    };

    // Ajustar anchos de columna
    sheet.columns = [
      { width: 30 },
      { width: 20 },
      { width: 18 },
      { width: 20 },
      { width: 22 },
      { width: 15 }
    ];

    // Bordes
    const lastRow = sheet.lastRow.number;
    for (let i = 5; i <= lastRow; i++) {
      for (let j = 1; j <= 6; j++) {
        const cell = sheet.getRow(i).getCell(j);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      }
    }
  }

  _addDetalleSheet(sheet, datos) {
    // Título
    sheet.mergeCells('A1:E1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'DETALLE POR MÉDICO';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FF10B981' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 25;

    sheet.addRow([]);

    datos.forEach((medico, idx) => {
      // Nombre del médico
      sheet.mergeCells(`A${sheet.lastRow.number + 1}:E${sheet.lastRow.number + 1}`);
      const medicoRow = sheet.addRow([medico.nombre_medico]);
      medicoRow.font = { size: 12, bold: true, color: { argb: 'FF2563EB' } };
      medicoRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E7FF' }
      };
      medicoRow.height = 22;

      // Métricas del médico
      sheet.addRow(['Total de Consultas:', medico.total_consultas]);
      sheet.addRow(['Pacientes Únicos:', medico.pacientes_unicos]);
      sheet.addRow(['Promedio Consultas/Día:', medico.promedio_consultas_dia.toFixed(2)]);

      // Diagnósticos frecuentes
      if (medico.diagnosticos_frecuentes && medico.diagnosticos_frecuentes.length > 0) {
        sheet.addRow(['']);
        const diagRow = sheet.addRow(['Diagnósticos Más Frecuentes', 'Cantidad']);
        diagRow.font = { bold: true };
        diagRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' }
        };

        medico.diagnosticos_frecuentes.slice(0, 5).forEach(diag => {
          sheet.addRow([diag.descripcion, diag.cantidad]);
        });
      }

      sheet.addRow(['']);
      sheet.addRow(['']);
    });

    // Ajustar anchos
    sheet.columns = [
      { width: 40 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 }
    ];
  }

  _addDiagnosticosSheet(sheet, datos) {
    // Título
    sheet.mergeCells('A1:C1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'DIAGNÓSTICOS MÁS FRECUENTES';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFF59E0B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 25;

    sheet.addRow([]);

    // Consolidar todos los diagnósticos
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

    // Ordenar por cantidad
    const diagnosticosOrdenados = Object.entries(todosLosDiagnosticos)
      .sort((a, b) => b[1] - a[1]);

    // Headers
    const headerRow = sheet.addRow(['#', 'Diagnóstico', 'Total']);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF59E0B' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 22;

    // Datos
    diagnosticosOrdenados.forEach(([diagnostico, cantidad], idx) => {
      const row = sheet.addRow([idx + 1, diagnostico, cantidad]);
      
      if (idx % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEF3C7' }
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

    // Ajustar anchos
    sheet.columns = [
      { width: 8 },
      { width: 50 },
      { width: 12 }
    ];

    // Bordes
    const lastRow = sheet.lastRow.number;
    for (let i = 4; i <= lastRow; i++) {
      for (let j = 1; j <= 3; j++) {
        const cell = sheet.getRow(i).getCell(j);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD97706' } },
          left: { style: 'thin', color: { argb: 'FFD97706' } },
          bottom: { style: 'thin', color: { argb: 'FFD97706' } },
          right: { style: 'thin', color: { argb: 'FFD97706' } }
        };
      }
    }
  }

  // ============================================
  // REPORTE DE CONSULTAS EN EXCEL
  // ============================================
  
  async generarConsultasExcel(consultas, filtro) {
    const workbook = new ExcelJS.Workbook();
    
    workbook.creator = 'Sistema de Gestión Médica';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Consultas', {
      properties: { tabColor: { argb: 'FF06B6D4' } }
    });

    // Título
    sheet.mergeCells('A1:G1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'REGISTRO DE CONSULTAS';
    titleCell.font = { size: 18, bold: true, color: { argb: 'FF06B6D4' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    // Info
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

    // Headers
    const headerRow = sheet.addRow([
      'Fecha',
      'Hora',
      'Paciente',
      'Médico',
      'Especialidad',
      'Motivo',
      'Diagnóstico Principal'
    ]);

    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF06B6D4' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;

    // Datos
    consultas.forEach((consulta, idx) => {
      const diagnosticoPrincipal = consulta.diagnosticos?.find(d => d.principal);
      
      const row = sheet.addRow([
        moment(consulta.created_at).format('DD/MM/YYYY'),
        moment(consulta.created_at).format('HH:mm'),
        consulta.paciente ? `${consulta.paciente.nombre} ${consulta.paciente.apellidos}` : 'N/A',
        consulta.medico ? `${consulta.medico.nombre} ${consulta.medico.apellidos}` : 'N/A',
        consulta.medico?.especialidad || 'N/A',
        consulta.motivo || 'N/A',
        diagnosticoPrincipal?.descripcion || 'N/A'
      ]);

      if (idx % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0F2FE' }
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
      { width: 18 },
      { width: 35 },
      { width: 35 }
    ];

    // Bordes
    const lastRow = sheet.lastRow.number;
    for (let i = 5; i <= lastRow; i++) {
      for (let j = 1; j <= 7; j++) {
        const cell = sheet.getRow(i).getCell(j);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF0891B2' } },
          left: { style: 'thin', color: { argb: 'FF0891B2' } },
          bottom: { style: 'thin', color: { argb: 'FF0891B2' } },
          right: { style: 'thin', color: { argb: 'FF0891B2' } }
        };
      }
    }

    // Guardar
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

  // ============================================
  // REPORTE DE PACIENTES EN EXCEL
  // ============================================
  
  async generarPacientesExcel(pacientes) {
    const workbook = new ExcelJS.Workbook();
    
    workbook.creator = 'Sistema de Gestión Médica';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Pacientes', {
      properties: { tabColor: { argb: 'FF10B981' } }
    });

    // Título
    sheet.mergeCells('A1:F1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'REGISTRO DE PACIENTES';
    titleCell.font = { size: 18, bold: true, color: { argb: 'FF10B981' } };
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

    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF10B981' }
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
          fgColor: { argb: 'FFD1FAE5' }
        };
      }

      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(6).alignment = { horizontal: 'center' };
    });

    // Ajustar anchos
    sheet.columns = [
      { width: 38 },
      { width: 30 },
      { width: 28 },
      { width: 18 },
      { width: 10 },
      { width: 12 }
    ];

    // Guardar
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
}

module.exports = new ExcelGenerator();