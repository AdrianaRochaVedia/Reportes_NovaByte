const express = require('express');
const fs = require('fs');
const path = require('path');
const { REPORTS_OUTPUT_DIR } = require('../config');

function setupDownloadRoutes(app) {

  app.get('/download/:fileName', (req, res) => {
    try {
      const fileName = req.params.fileName;
      
      console.log(`Solicitud de descarga: ${fileName}`);
      
      if (!fileName) {
        console.error('Nombre de archivo vacío');
        return res.status(400).json({ 
          error: 'Nombre de archivo requerido',
          ok: false 
        });
      }
      
      if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
        console.error('Intento de path traversal detectado');
        return res.status(400).json({ 
          error: 'Nombre de archivo inválido',
          ok: false 
        });
      }
      
      const allowedExtensions = ['.pdf', '.xlsx', '.xls', '.csv'];
      const fileExtension = path.extname(fileName).toLowerCase();
      
      if (!allowedExtensions.includes(fileExtension)) {
        console.error('Tipo de archivo no permitido');
        return res.status(400).json({ 
          error: 'Solo se permiten archivos PDF, Excel y CSV',
          ok: false 
        });
      }
      
      const validPatterns = [
        /^historia_clinica_.+_\d+\.pdf$/,
        /^agenda_medico_\d+\.pdf$/,
        /^desempeno_medicos_\d+\.(pdf|xlsx)$/,
        /^dashboard_estadisticas_\d+\.pdf$/,
        /^resumen_consultas_\d+\.pdf$/,
        /^consultas_\d+\.xlsx$/,
        /^pacientes_\d+\.xlsx$/
      ];
      
      const isValidFormat = validPatterns.some(pattern => pattern.test(fileName));
      
      if (!isValidFormat) {
        console.error('Formato de nombre inválido:', fileName);
        return res.status(400).json({ 
          error: 'Formato de nombre de archivo no válido',
          ok: false 
        });
      }

      const filePath = path.join(REPORTS_OUTPUT_DIR, fileName);
      const normalizedPath = path.normalize(filePath);
      const normalizedOutputDir = path.normalize(REPORTS_OUTPUT_DIR);
      

      if (!normalizedPath.startsWith(normalizedOutputDir)) {
        console.error('Intento de acceso fuera del directorio permitido');
        return res.status(403).json({ 
          error: 'Acceso denegado',
          ok: false 
        });
      }
      
      if (!fs.existsSync(filePath)) {
        console.error(`Archivo no encontrado: ${fileName}`);
        return res.status(404).json({ 
          error: 'Archivo no encontrado o expirado',
          ok: false 
        });
      }
      
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      const fileSizeKB = (fileSize / 1024).toFixed(2);
      
      console.log(`Enviando archivo: ${fileName} (${fileSizeKB} KB)`);
      
      const mimeTypes = {
        '.pdf': 'application/pdf',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xls': 'application/vnd.ms-excel',
        '.csv': 'text/csv'
      };
      
      const contentType = mimeTypes[fileExtension] || 'application/octet-stream';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    
      const fileStream = fs.createReadStream(filePath);
      
      fileStream.on('error', (streamError) => {
        console.error(`Error al leer el archivo: ${streamError.message}`);
        if (!res.headersSent) {
          res.status(500).json({ 
            error: 'Error al leer el archivo',
            ok: false 
          });
        }
      });
      
      fileStream.on('end', () => {
        console.log(`Descarga completada: ${fileName}`);
      });
      
      fileStream.pipe(res);
      
    } catch (error) {
      console.error(`Error en la descarga del archivo: ${error.message}`);
      console.error(error.stack);
      
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Error interno del servidor al procesar la descarga',
          ok: false 
        });
      }
    }
  });


  app.get('/download/check/:fileName', (req, res) => {
    try {
      const fileName = req.params.fileName;
      
      // Validaciones básicas
      if (!fileName || fileName.includes('..')) {
        return res.status(400).json({ 
          exists: false,
          error: 'Nombre de archivo inválido',
          ok: false 
        });
      }
      
      const allowedExtensions = ['.pdf', '.xlsx', '.xls', '.csv'];
      const fileExtension = path.extname(fileName).toLowerCase();
      
      if (!allowedExtensions.includes(fileExtension)) {
        return res.status(400).json({ 
          exists: false,
          error: 'Tipo de archivo no permitido',
          ok: false 
        });
      }
      
      const filePath = path.join(REPORTS_OUTPUT_DIR, fileName);
      const exists = fs.existsSync(filePath);
      
      if (exists) {
        const stats = fs.statSync(filePath);
        const fileSize = stats.size;
        const fileSizeKB = (fileSize / 1024).toFixed(2);
        const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
        
        return res.json({ 
          exists: true,
          fileName,
          size: fileSize < 1024 * 1024 ? `${fileSizeKB} KB` : `${fileSizeMB} MB`,
          sizeBytes: fileSize,
          createdAt: stats.birthtime,
          type: fileExtension.replace('.', '').toUpperCase(),
          ok: true
        });
      } else {
        return res.json({ 
          exists: false,
          ok: true
        });
      }
      
    } catch (error) {
      console.error(`Error al verificar archivo: ${error.message}`);
      res.status(500).json({ 
        exists: false,
        error: 'Error al verificar el archivo',
        ok: false 
      });
    }
  });
  

  app.get('/download/list/all', (req, res) => {
    try {
      if (!fs.existsSync(REPORTS_OUTPUT_DIR)) {
        return res.json({ 
          files: [],
          total: 0,
          byType: {},
          ok: true 
        });
      }
      
      const allowedExtensions = ['.pdf', '.xlsx', '.xls', '.csv'];
      
      const files = fs.readdirSync(REPORTS_OUTPUT_DIR)
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return allowedExtensions.includes(ext);
        })
        .map(file => {
          const filePath = path.join(REPORTS_OUTPUT_DIR, file);
          const stats = fs.statSync(filePath);
          const fileExtension = path.extname(file).toLowerCase();
          
          // Determinar tipo de reporte
          let reportType = 'Otro';
          if (file.includes('historia_clinica')) reportType = 'Historia Clínica';
          else if (file.includes('agenda_medico')) reportType = 'Agenda Médico';
          else if (file.includes('desempeno_medicos')) reportType = 'Desempeño Médicos';
          else if (file.includes('dashboard_estadisticas')) reportType = 'Dashboard';
          else if (file.includes('resumen_consultas')) reportType = 'Resumen Consultas';
          else if (file.includes('consultas')) reportType = 'Consultas';
          else if (file.includes('pacientes')) reportType = 'Pacientes';
          
          return {
            name: file,
            reportType,
            format: fileExtension.replace('.', '').toUpperCase(),
            size: `${(stats.size / 1024).toFixed(2)} KB`,
            sizeBytes: stats.size,
            createdAt: stats.birthtime,
            age: Date.now() - stats.birthtimeMs,
            downloadUrl: `/download/${file}`
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      
      // Agrupar por tipo
      const byType = files.reduce((acc, file) => {
        if (!acc[file.reportType]) {
          acc[file.reportType] = [];
        }
        acc[file.reportType].push(file);
        return acc;
      }, {});
      
      console.log(`Listando ${files.length} archivos disponibles`);
      
      res.json({ 
        files,
        total: files.length,
        byType,
        ok: true 
      });
      
    } catch (error) {
      console.error(`Error al listar archivos: ${error.message}`);
      res.status(500).json({ 
        error: 'Error al listar archivos',
        ok: false 
      });
    }
  });
  
  // Eliminar un reporte
  app.delete('/download/:fileName', (req, res) => {
    try {
      const fileName = req.params.fileName;
      
      console.log(`Solicitud de eliminación: ${fileName}`);
      
      if (!fileName || fileName.includes('..')) {
        return res.status(400).json({ 
          error: 'Nombre de archivo inválido',
          ok: false 
        });
      }
      
      const allowedExtensions = ['.pdf', '.xlsx', '.xls', '.csv'];
      const fileExtension = path.extname(fileName).toLowerCase();
      
      if (!allowedExtensions.includes(fileExtension)) {
        return res.status(400).json({ 
          error: 'Tipo de archivo no permitido',
          ok: false 
        });
      }
      
      const filePath = path.join(REPORTS_OUTPUT_DIR, fileName);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ 
          error: 'Archivo no encontrado',
          ok: false 
        });
      }
      
      fs.unlinkSync(filePath);
      
      console.log(`Archivo eliminado: ${fileName}`);
      
      res.json({ 
        message: 'Archivo eliminado exitosamente',
        fileName,
        ok: true 
      });
      
    } catch (error) {
      console.error(`Error al eliminar archivo: ${error.message}`);
      res.status(500).json({ 
        error: 'Error al eliminar el archivo',
        ok: false 
      });
    }
  });

  // Eliminar reportes antiguos (cleanup manual)
  app.delete('/download/cleanup/old', (req, res) => {
    try {
      const maxAge = req.query.hours ? parseInt(req.query.hours) * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      
      if (!fs.existsSync(REPORTS_OUTPUT_DIR)) {
        return res.json({ 
          deleted: 0,
          message: 'Directorio no existe',
          ok: true 
        });
      }
      
      const now = Date.now();
      let deletedCount = 0;
      const deletedFiles = [];
      
      fs.readdirSync(REPORTS_OUTPUT_DIR).forEach(file => {
        const filePath = path.join(REPORTS_OUTPUT_DIR, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          deletedCount++;
          deletedFiles.push(file);
        }
      });
      
      console.log(`Cleanup completado: ${deletedCount} archivos eliminados`);
      
      res.json({ 
        deleted: deletedCount,
        files: deletedFiles,
        message: `${deletedCount} archivos eliminados`,
        ok: true 
      });
      
    } catch (error) {
      console.error(`Error en cleanup: ${error.message}`);
      res.status(500).json({ 
        error: 'Error al limpiar archivos antiguos',
        ok: false 
      });
    }
  });

  // Estadísticas de reportes
  app.get('/download/stats', (req, res) => {
    try {
      if (!fs.existsSync(REPORTS_OUTPUT_DIR)) {
        return res.json({ 
          totalFiles: 0,
          totalSize: '0 KB',
          byFormat: {},
          byType: {},
          ok: true 
        });
      }
      
      const allowedExtensions = ['.pdf', '.xlsx', '.xls', '.csv'];
      let totalSize = 0;
      const byFormat = {};
      const byType = {};
      
      const files = fs.readdirSync(REPORTS_OUTPUT_DIR)
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return allowedExtensions.includes(ext);
        });
      
      files.forEach(file => {
        const filePath = path.join(REPORTS_OUTPUT_DIR, file);
        const stats = fs.statSync(filePath);
        const format = path.extname(file).toLowerCase().replace('.', '').toUpperCase();
        
        totalSize += stats.size;
        
        byFormat[format] = (byFormat[format] || 0) + 1;
        
        let reportType = 'Otro';
        if (file.includes('historia_clinica')) reportType = 'Historia Clínica';
        else if (file.includes('agenda_medico')) reportType = 'Agenda Médico';
        else if (file.includes('desempeno_medicos')) reportType = 'Desempeño Médicos';
        else if (file.includes('dashboard')) reportType = 'Dashboard';
        
        byType[reportType] = (byType[reportType] || 0) + 1;
      });
      
      const totalSizeKB = (totalSize / 1024).toFixed(2);
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      
      res.json({ 
        totalFiles: files.length,
        totalSize: totalSize < 1024 * 1024 ? `${totalSizeKB} KB` : `${totalSizeMB} MB`,
        totalSizeBytes: totalSize,
        byFormat,
        byType,
        ok: true 
      });
      
    } catch (error) {
      console.error(`Error al obtener estadísticas: ${error.message}`);
      res.status(500).json({ 
        error: 'Error al obtener estadísticas',
        ok: false 
      });
    }
  });
}

module.exports = { setupDownloadRoutes };