const reporteMedicoService = require('../../services/reporteMedicoService');
const pdfGenerator = require('../../utils/pdfGenerator');

module.exports = {
  Query: {
    obtenerPaciente: async (_, { id }, { supabase, token }) => {
      try {
        return await reporteMedicoService.getPaciente(id, supabase);
      } catch (error) {
        throw new Error(`Error al obtener paciente: ${error.message}`);
      }
    },

    obtenerMedico: async (_, { id }, { supabase, token }) => {
      try {
        return await reporteMedicoService.getMedico(id, supabase);
      } catch (error) {
        throw new Error(`Error al obtener médico: ${error.message}`);
      }
    },

    listarConsultas: async (_, { filtro = {} }, { supabase, token }) => {
      try {
        return await reporteMedicoService.getConsultas(filtro, supabase);
      } catch (error) {
        throw new Error(`Error al listar consultas: ${error.message}`);
      }
    },

    estadisticasMedico: async (_, { filtro = {} }, { supabase, token }) => {
      try {
        return await reporteMedicoService.getEstadisticasMedico(filtro, supabase);
      } catch (error) {
        throw new Error(`Error al obtener estadísticas del médico: ${error.message}`);
      }
    },

    estadisticasGenerales: async (_, { filtro = {} }, { supabase, token }) => {
      try {
        return await reporteMedicoService.getEstadisticasGenerales(filtro, supabase);
      } catch (error) {
        throw new Error(`Error al obtener estadísticas generales: ${error.message}`);
      }
    },

    citasPorEstado: async (_, { filtro }, { supabase, token }) => {
      try {
        return await reporteMedicoService.getCitasPorEstado(filtro, supabase);
      } catch (error) {
        throw new Error(`Error al obtener citas por estado: ${error.message}`);
      }
    },
  },

  Mutation: {
    // REPORTES PARA MÉDICOS
    generarHistoriaClinicaPDF: async (_, { filtro }, { supabase, token }) => {
      try {
        console.log('Generando Historia Clínica PDF para paciente:', filtro.paciente_id);
        
        const datos = await reporteMedicoService.getHistoriaClinicaCompleta(filtro, supabase);
        
        if (!datos) {
          throw new Error('No se encontraron datos del paciente.');
        }

        const result = await pdfGenerator.generarHistoriaClinicaPDF(datos, filtro);
        
        return {
          fileName: result.fileName,
          downloadUrl: result.downloadUrl,
          formato: 'PDF',
          generado_en: new Date().toISOString(),
          metadata: {
            total_registros: datos.consultas?.length || 0,
            filtros_aplicados: JSON.stringify(filtro),
            periodo: filtro.fecha_desde && filtro.fecha_hasta 
              ? `${filtro.fecha_desde} - ${filtro.fecha_hasta}` 
              : 'Completo',
            tipo_reporte: 'Historia Clínica'
          }
        };
      } catch (error) {
        console.error('Error al generar Historia Clínica PDF:', error);
        throw new Error(`Error al generar Historia Clínica PDF: ${error.message}`);
      }
    },

    generarAgendaMedicoPDF: async (_, { filtro }, { supabase, token }) => {
      try {
        console.log('Generando Agenda Médico PDF:', filtro);
        
        const datos = await reporteMedicoService.getAgendaMedico(filtro, supabase);
        
        if (!datos || datos.citas.length === 0) {
          throw new Error('No se encontraron citas para el período especificado.');
        }

        const result = await pdfGenerator.generarAgendaMedicoPDF(datos, filtro);
        
        return {
          fileName: result.fileName,
          downloadUrl: result.downloadUrl,
          formato: 'PDF',
          generado_en: new Date().toISOString(),
          metadata: {
            total_registros: datos.citas.length,
            filtros_aplicados: JSON.stringify(filtro),
            periodo: `${filtro.fecha_desde} - ${filtro.fecha_hasta}`,
            tipo_reporte: 'Agenda Médico'
          }
        };
      } catch (error) {
        console.error('Error al generar Agenda Médico PDF:', error);
        throw new Error(`Error al generar Agenda Médico PDF: ${error.message}`);
      }
    },

    generarResumenConsultasPDF: async (_, { filtro }, { supabase, token }) => {
      try {
        console.log('Generando Resumen de Consultas PDF:', filtro);
        
        const consultas = await reporteMedicoService.getConsultas(filtro, supabase);
        
        if (!consultas || consultas.length === 0) {
          throw new Error('No se encontraron consultas para los filtros aplicados.');
        }

        const result = await pdfGenerator.generarResumenConsultasPDF(consultas, filtro);
        
        return {
          fileName: result.fileName,
          downloadUrl: result.downloadUrl,
          formato: 'PDF',
          generado_en: new Date().toISOString(),
          metadata: {
            total_registros: consultas.length,
            filtros_aplicados: JSON.stringify(filtro),
            periodo: filtro.fecha_desde && filtro.fecha_hasta 
              ? `${filtro.fecha_desde} - ${filtro.fecha_hasta}` 
              : 'Sin período definido',
            tipo_reporte: 'Resumen de Consultas'
          }
        };
      } catch (error) {
        console.error('Error al generar Resumen de Consultas PDF:', error);
        throw new Error(`Error al generar Resumen de Consultas PDF: ${error.message}`);
      }
    },

    // REPORTES PARA ADMIN
    generarDesempenoMedicosPDF: async (_, { filtro = {} }, { supabase, token }) => {
      try {
        console.log('Generando Reporte de Desempeño Médicos PDF:', filtro);
        
        const datos = await reporteMedicoService.getDesempenoMedicos(filtro, supabase);
        
        if (!datos || datos.length === 0) {
          throw new Error('No se encontraron datos de médicos para el período especificado.');
        }

        const result = await pdfGenerator.generarDesempenoMedicosPDF(datos, filtro);
        
        return {
          fileName: result.fileName,
          downloadUrl: result.downloadUrl,
          formato: 'PDF',
          generado_en: new Date().toISOString(),
          metadata: {
            total_registros: datos.length,
            filtros_aplicados: JSON.stringify(filtro),
            periodo: filtro.fecha_desde && filtro.fecha_hasta 
              ? `${filtro.fecha_desde} - ${filtro.fecha_hasta}` 
              : 'Período completo',
            tipo_reporte: 'Desempeño Médicos'
          }
        };
      } catch (error) {
        console.error('Error al generar Desempeño Médicos PDF:', error);
        throw new Error(`Error al generar Desempeño Médicos PDF: ${error.message}`);
      }
    },

    generarDesempenoMedicosExcel: async (_, { filtro = {} }, { supabase, token }) => {
      try {
        console.log('Generando Reporte de Desempeño Médicos Excel:', filtro);
        
        const datos = await reporteMedicoService.getDesempenoMedicos(filtro, supabase);
        
        if (!datos || datos.length === 0) {
          throw new Error('No se encontraron datos de médicos para el período especificado.');
        }

        const excelGenerator = require('../../utils/excelGenerator');
        const result = await excelGenerator.generarDesempenoMedicosExcel(datos, filtro);
        
        return {
          fileName: result.fileName,
          downloadUrl: result.downloadUrl,
          formato: 'XLSX',
          generado_en: new Date().toISOString(),
          metadata: {
            total_registros: datos.length,
            filtros_aplicados: JSON.stringify(filtro),
            periodo: filtro.fecha_desde && filtro.fecha_hasta 
              ? `${filtro.fecha_desde} - ${filtro.fecha_hasta}` 
              : 'Período completo',
            tipo_reporte: 'Desempeño Médicos'
          }
        };
      } catch (error) {
        console.error('Error al generar Desempeño Médicos Excel:', error);
        throw new Error(`Error al generar Desempeño Médicos Excel: ${error.message}`);
      }
    },

    generarDashboardEstadisticasPDF: async (_, { filtro = {} }, { supabase, token }) => {
      try {
        console.log('Generando Dashboard de Estadísticas PDF:', filtro);
        
        const estadisticas = await reporteMedicoService.getEstadisticasGenerales(filtro, supabase);
        
        if (!estadisticas) {
          throw new Error('No se pudieron obtener las estadísticas generales.');
        }

        const result = await pdfGenerator.generarDashboardEstadisticasPDF(estadisticas, filtro);
        
        return {
          fileName: result.fileName,
          downloadUrl: result.downloadUrl,
          formato: 'PDF',
          generado_en: new Date().toISOString(),
          metadata: {
            total_registros: estadisticas.total_consultas || 0,
            filtros_aplicados: JSON.stringify(filtro),
            periodo: filtro.fecha_desde && filtro.fecha_hasta 
              ? `${filtro.fecha_desde} - ${filtro.fecha_hasta}` 
              : 'Período actual',
            tipo_reporte: 'Dashboard Estadísticas'
          }
        };
      } catch (error) {
        console.error('Error al generar Dashboard Estadísticas PDF:', error);
        throw new Error(`Error al generar Dashboard Estadísticas PDF: ${error.message}`);
      }
    },

    generarReporteCustom: async (_, { tipo, formato, filtros, opciones }, { supabase, token }) => {
      try {
        console.log(`Generando reporte custom: ${tipo} en formato ${formato}`);
        
        // Parsear filtros y opciones
        const filtrosParsed = filtros ? JSON.parse(filtros) : {};
        const opcionesParsed = opciones ? JSON.parse(opciones) : {};
        
        throw new Error('Reporte custom no implementado aún');
      } catch (error) {
        console.error('Error al generar reporte custom:', error);
        throw new Error(`Error al generar reporte custom: ${error.message}`);
      }
    },
  }
};