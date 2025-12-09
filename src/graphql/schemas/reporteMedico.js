const { gql } = require('apollo-server');

const reporteMedicoSchema = gql`
  # Tipos básicos
  type Perfil {
    id: ID!
    nombre: String
    apellidos: String
    email: String
    rol: String
    fecha_nacimiento: String
    especialidad: String
    activo: Boolean
  }

  type Paciente {
    id: ID!
    nombre: String
    apellidos: String
    email: String
    fecha_nacimiento: String
    edad: Int
  }

  type Medico {
    id: ID!
    nombre: String
    apellidos: String
    email: String
    especialidad: String
    activo: Boolean
  }

  type Consulta {
    id: ID!
    fecha: String
    motivo: String
    diagnosticos: [Diagnostico]
    receta: Receta
    signosVitales: SignosVitales
  }

  type Diagnostico {
    id: ID!
    codigo: String
    descripcion: String
    principal: Boolean
  }

  type Receta {
    id: ID!
    indicaciones_generales: String
    items: [RecetaItem]
  }

  type RecetaItem {
    medicamento: String
    dosis: String
    frecuencia: String
    duracion: String
  }

  type SignosVitales {
    presion_sistolica: Int
    presion_diastolica: Int
    frecuencia_cardiaca: Int
    temperatura: Float
    saturacion_oxigeno: Int
    peso_kg: Float
    talla_cm: Float
  }

  type Antecedente {
    tipo: String
    descripcion: String
  }

  type Alergia {
    sustancia: String
    severidad: String
    observacion: String
  }

  type Cita {
    id: ID!
    fecha_hora: String
    estado: String
    tipo_cita: String
    paciente: Paciente
    medico: Medico
  }

  # Tipos para estadísticas
  type EstadisticaMedico {
    medico_id: ID!
    nombre_medico: String
    total_consultas: Int
    pacientes_unicos: Int
    promedio_consultas_dia: Float
    diagnosticos_frecuentes: [DiagnosticoFrecuente]
  }

  type DiagnosticoFrecuente {
    descripcion: String
    cantidad: Int
  }

  type EstadisticaGeneral {
    total_medicos_activos: Int
    total_pacientes: Int
    total_consultas: Int
    consultas_mes_actual: Int
    citas_programadas: Int
    citas_completadas: Int
  }

  type CitaPorEstado {
    estado: String
    cantidad: Int
  }

  # Filtros de entrada
  input FiltroHistoriaClinica {
    paciente_id: ID!
    fecha_desde: String
    fecha_hasta: String
    incluir_antecedentes: Boolean
    incluir_alergias: Boolean
    incluir_examenes: Boolean
  }

  input FiltroAgendaMedico {
    medico_id: ID!
    fecha_desde: String
    fecha_hasta: String
    incluir_estado: [String]
  }

  input FiltroDesempenoMedico {
    medico_id: ID
    fecha_desde: String
    fecha_hasta: String
  }

  input FiltroEstadisticasGenerales {
    fecha_desde: String
    fecha_hasta: String
  }

  input FiltroConsultas {
    paciente_id: ID
    medico_id: ID
    fecha_desde: String
    fecha_hasta: String
  }

  # Respuestas de generación de reportes
  type ReporteResponse {
    fileName: String!
    downloadUrl: String!
    formato: String!
    generado_en: String!
    metadata: ReporteMetadata
  }

  type ReporteMetadata {
    total_registros: Int
    filtros_aplicados: String
    periodo: String
    tipo_reporte: String
  }

  # Queries
  type Query {
    # Consultas para datos
    obtenerPaciente(id: ID!): Paciente
    obtenerMedico(id: ID!): Medico
    listarConsultas(filtro: FiltroConsultas): [Consulta]
    
    # Estadísticas
    estadisticasMedico(filtro: FiltroDesempenoMedico): EstadisticaMedico
    estadisticasGenerales(filtro: FiltroEstadisticasGenerales): EstadisticaGeneral
    citasPorEstado(filtro: FiltroAgendaMedico): [CitaPorEstado]
  }

  # Mutations para generar reportes
  type Mutation {
    # Reportes para Médicos
    generarHistoriaClinicaPDF(filtro: FiltroHistoriaClinica!): ReporteResponse
    generarAgendaMedicoPDF(filtro: FiltroAgendaMedico!): ReporteResponse
    generarResumenConsultasPDF(filtro: FiltroConsultas!): ReporteResponse
    
    # Reportes para Admin
    generarDesempenoMedicosPDF(filtro: FiltroDesempenoMedico): ReporteResponse
    generarDesempenoMedicosExcel(filtro: FiltroDesempenoMedico): ReporteResponse
    generarDashboardEstadisticasPDF(filtro: FiltroEstadisticasGenerales): ReporteResponse
    
    # Reporte general (flexible)
    generarReporteCustom(
      tipo: String!
      formato: String!
      filtros: String
      opciones: String
    ): ReporteResponse
  }
`;

module.exports = reporteMedicoSchema;