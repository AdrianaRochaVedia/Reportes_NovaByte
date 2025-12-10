const moment = require('moment');

class ReporteMedicoService {
  async getPaciente(id, supabase) {
    try {
      const { data, error } = await supabase
        .from('perfil')
        .select('*')
        .eq('id', id)
        .eq('rol', 'paciente')
        .single();

      if (error) throw error;
      
      // Calcular edad
      if (data.fecha_nacimiento) {
        const edad = moment().diff(moment(data.fecha_nacimiento), 'years');
        data.edad = edad;
      }

      return data;
    } catch (error) {
      console.error('Error al obtener paciente:', error);
      throw error;
    }
  }

  async getMedico(id, supabase) {
    try {
      const { data, error } = await supabase
        .from('perfil')
        .select('*')
        .eq('id', id)
        .in('rol', ['medico', 'medicoAdmin'])
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al obtener médico:', error);
      throw error;
    }
  }

  async getConsultas(filtro, supabase) {
    try {
      let query = supabase
        .from('consulta')
        .select(`
          *,
          paciente:paciente_id(id, nombre, apellidos, email, fecha_nacimiento),
          medico:medico_id(id, nombre, apellidos, especialidad)
        `);

      if (filtro.paciente_id) {
        query = query.eq('paciente_id', filtro.paciente_id);
      }

      if (filtro.medico_id) {
        query = query.eq('medico_id', filtro.medico_id);
      }

      if (filtro.fecha_desde) {
        query = query.gte('created_at', filtro.fecha_desde);
      }

      if (filtro.fecha_hasta) {
        query = query.lte('created_at', filtro.fecha_hasta);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al obtener consultas:', error);
      throw error;
    }
  }

  // HISTORIA CLÍNICA COMPLETA
  
  async getHistoriaClinicaCompleta(filtro, supabase) {
    try {
      const pacienteId = filtro.paciente_id;
      const paciente = await this.getPaciente(pacienteId, supabase);

      let antecedentes = [];
      if (filtro.incluir_antecedentes !== false) {
        const { data } = await supabase
          .from('antecedente')
          .select('*')
          .eq('paciente_id', pacienteId);
        antecedentes = data || [];
      }

      let alergias = [];
      if (filtro.incluir_alergias !== false) {
        const { data } = await supabase
          .from('alergia')
          .select('*')
          .eq('paciente_id', pacienteId);
        alergias = data || [];
      }

      let queryConsultas = supabase
        .from('consulta')
        .select(`
          *,
          medico:medico_id(nombre, apellidos, especialidad)
        `)
        .eq('paciente_id', pacienteId);

      if (filtro.fecha_desde) {
        queryConsultas = queryConsultas.gte('created_at', filtro.fecha_desde);
      }

      if (filtro.fecha_hasta) {
        queryConsultas = queryConsultas.lte('created_at', filtro.fecha_hasta);
      }

      queryConsultas = queryConsultas.order('created_at', { ascending: false });

      const { data: consultas } = await queryConsultas;
      const consultasEnriquecidas = await Promise.all(
        (consultas || []).map(async (consulta) => {
          // Diagnósticos
          const { data: diagnosticos } = await supabase
            .from('diagnostico')
            .select('*')
            .eq('consulta_id', consulta.id);

          // Receta con items
          const { data: recetas } = await supabase
            .from('receta')
            .select(`
              *,
              items:receta_item(*)
            `)
            .eq('consulta_id', consulta.id);

          // Signos vitales
          const { data: signosVitales } = await supabase
            .from('signos_vitales')
            .select('*')
            .eq('consulta_id', consulta.id)
            .single();

          return {
            ...consulta,
            diagnosticos: diagnosticos || [],
            receta: recetas?.[0] || null,
            signosVitales: signosVitales || null
          };
        })
      );

      let examenes = [];
      if (filtro.incluir_examenes) {
        const consultasIds = consultasEnriquecidas.map(c => c.id);
        if (consultasIds.length > 0) {
          const { data } = await supabase
            .from('examen')
            .select(`
              *,
              resultado:resultado_examen(*)
            `)
            .in('consulta_id', consultasIds);
          examenes = data || [];
        }
      }

      return {
        paciente,
        antecedentes,
        alergias,
        consultas: consultasEnriquecidas,
        examenes
      };
    } catch (error) {
      console.error('Error al obtener historia clínica completa:', error);
      throw error;
    }
  }

  // AGENDA DEL MÉDICO
  
  async getAgendaMedico(filtro, supabase) {
    try {
      let query = supabase
        .from('cita')
        .select(`
          *,
          paciente:paciente_id(id, nombre, apellidos, email),
          medico:medico_id(id, nombre, apellidos, especialidad)
        `)
        .eq('medico_id', filtro.medico_id);

      if (filtro.fecha_desde) {
        query = query.gte('fecha_hora', filtro.fecha_desde);
      }

      if (filtro.fecha_hasta) {
        query = query.lte('fecha_hora', filtro.fecha_hasta);
      }

      if (filtro.incluir_estado && filtro.incluir_estado.length > 0) {
        query = query.in('estado', filtro.incluir_estado);
      }

      query = query.order('fecha_hora', { ascending: true });

      const { data: citas, error } = await query;

      if (error) throw error;

      const medico = await this.getMedico(filtro.medico_id, supabase);

      return {
        medico,
        citas: citas || []
      };
    } catch (error) {
      console.error('Error al obtener agenda del médico:', error);
      throw error;
    }
  }


  // ESTADÍSTICAS DEL MÉDICO
  
  async getEstadisticasMedico(filtro, supabase) {
    try {
      const medicoId = filtro.medico_id;
      const medico = await this.getMedico(medicoId, supabase);

      let queryConsultas = supabase
        .from('consulta')
        .select('id, paciente_id, created_at')
        .eq('medico_id', medicoId);

      if (filtro.fecha_desde) {
        queryConsultas = queryConsultas.gte('created_at', filtro.fecha_desde);
      }

      if (filtro.fecha_hasta) {
        queryConsultas = queryConsultas.lte('created_at', filtro.fecha_hasta);
      }

      const { data: consultas } = await queryConsultas;

      const totalConsultas = consultas?.length || 0;
      const pacientesUnicos = new Set(consultas?.map(c => c.paciente_id)).size;

      // Calcular promedio de consultas por día
      let promedioDia = 0;
      if (filtro.fecha_desde && filtro.fecha_hasta && totalConsultas > 0) {
        const dias = moment(filtro.fecha_hasta).diff(moment(filtro.fecha_desde), 'days') + 1;
        promedioDia = parseFloat((totalConsultas / dias).toFixed(2));
      }

      const consultasIds = consultas?.map(c => c.id) || [];
      let diagnosticosFrecuentes = [];
      
      if (consultasIds.length > 0) {
        const { data: diagnosticos } = await supabase
          .from('diagnostico')
          .select('descripcion')
          .in('consulta_id', consultasIds);

        const conteo = {};
        diagnosticos?.forEach(d => {
          conteo[d.descripcion] = (conteo[d.descripcion] || 0) + 1;
        });

        diagnosticosFrecuentes = Object.entries(conteo)
          .map(([descripcion, cantidad]) => ({ descripcion, cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad)
          .slice(0, 10);
      }

      return {
        medico_id: medicoId,
        nombre_medico: `${medico.nombre} ${medico.apellidos}`,
        total_consultas: totalConsultas,
        pacientes_unicos: pacientesUnicos,
        promedio_consultas_dia: promedioDia,
        diagnosticos_frecuentes: diagnosticosFrecuentes
      };
    } catch (error) {
      console.error('Error al obtener estadísticas del médico:', error);
      throw error;
    }
  }

  // DESEMPEÑO DE MÚLTIPLES MÉDICOS (ADMIN)

  
  async getDesempenoMedicos(filtro, supabase) {
    try {
      let queryMedicos = supabase
        .from('perfil')
        .select('id, nombre, apellidos, especialidad, activo')
        .in('rol', ['medico', 'medicoAdmin']);

      if (filtro.medico_id) {
        queryMedicos = queryMedicos.eq('id', filtro.medico_id);
      } else {
        queryMedicos = queryMedicos.eq('activo', true);
      }

      const { data: medicos } = await queryMedicos;

      // Para cada medico sus estadisticas
      const desempeno = await Promise.all(
        (medicos || []).map(async (medico) => {
          return await this.getEstadisticasMedico(
            { medico_id: medico.id, ...filtro },
            supabase
          );
        })
      );

      return desempeno;
    } catch (error) {
      console.error('Error al obtener desempeño de médicos:', error);
      throw error;
    }
  }

  // ESTADÍSTICAS GENERALES (DASHBOARD ADMIN)
  
  async getEstadisticasGenerales(filtro, supabase) {
    try {
      // Total médicos activos
      const { count: totalMedicos } = await supabase
        .from('perfil')
        .select('id', { count: 'exact', head: true })
        .in('rol', ['medico', 'medicoAdmin'])
        .eq('activo', true);

      // Total pacientes
      const { count: totalPacientes } = await supabase
        .from('perfil')
        .select('id', { count: 'exact', head: true })
        .eq('rol', 'paciente');

      // Total consultas 
      let queryConsultas = supabase
        .from('consulta')
        .select('id, created_at', { count: 'exact' });

      if (filtro.fecha_desde) {
        queryConsultas = queryConsultas.gte('created_at', filtro.fecha_desde);
      }

      if (filtro.fecha_hasta) {
        queryConsultas = queryConsultas.lte('created_at', filtro.fecha_hasta);
      }

      const { count: totalConsultas } = await queryConsultas;

      // Consultas del mes actual
      const inicioMes = moment().startOf('month').format('YYYY-MM-DD');
      const finMes = moment().endOf('month').format('YYYY-MM-DD');

      const { count: consultasMesActual } = await supabase
        .from('consulta')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', inicioMes)
        .lte('created_at', finMes);

      // Citas programadas
      const { count: citasProgramadas } = await supabase
        .from('cita')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'programada');

      // Citas completadas
      const { count: citasCompletadas } = await supabase
        .from('cita')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'completada');

      return {
        total_medicos_activos: totalMedicos || 0,
        total_pacientes: totalPacientes || 0,
        total_consultas: totalConsultas || 0,
        consultas_mes_actual: consultasMesActual || 0,
        citas_programadas: citasProgramadas || 0,
        citas_completadas: citasCompletadas || 0
      };
    } catch (error) {
      console.error('Error al obtener estadísticas generales:', error);
      throw error;
    }
  }

  // CITAS POR ESTADO
  
  async getCitasPorEstado(filtro, supabase) {
    try {
      let query = supabase
        .from('cita')
        .select('estado');

      if (filtro.medico_id) {
        query = query.eq('medico_id', filtro.medico_id);
      }

      if (filtro.fecha_desde) {
        query = query.gte('fecha_hora', filtro.fecha_desde);
      }

      if (filtro.fecha_hasta) {
        query = query.lte('fecha_hora', filtro.fecha_hasta);
      }

      const { data: citas } = await query;

      // Agrupar por estado
      const conteo = {};
      citas?.forEach(c => {
        conteo[c.estado] = (conteo[c.estado] || 0) + 1;
      });

      return Object.entries(conteo).map(([estado, cantidad]) => ({
        estado,
        cantidad
      }));
    } catch (error) {
      console.error('Error al obtener citas por estado:', error);
      throw error;
    }
  }
}

module.exports = new ReporteMedicoService();