const express = require('express');
const router = express.Router();
const mysql = require('mysql');
const path = require('path');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'usuario@gmail.com',
    pass: 'password'
  }
})

function enviarCorreoBienvenida(email, nombre){
  const opciones = {
    from: 'usuario@gmail.com',
    to: email,
    subject: 'Bienvenido al blog de viajes',
    text: `Hola ${nombre}`
  }
  transporter.sendMail(opciones, (error, info) => {
  });
}

const pool = mysql.createPool({
    connectionLimit: 20,
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'blog_viajes'
});

router.get('/', function(peticion, res){
    pool.getConnection((error, connection)=>{
      let pagina = 0
      let modificadorPagina = ""
      let consulta
      let modificadorConsulta = ""
      const busqueda = ( peticion.query.busqueda ) ? peticion.query.busqueda : ""
      if (busqueda != ""){
        modificadorConsulta = `
          WHERE
          titulo LIKE '%${busqueda}%' OR
          resumen LIKE '%${busqueda}%' OR
          contenido LIKE '%${busqueda}%'
        `
        modificadorPagina = 0
      }
      else{
        pagina = ( peticion.query.pagina ) ? parseInt(peticion.query.pagina) : 0
        if (pagina < 0) {
          pagina = 0
        }
        modificadorPagina = `
          LIMIT 5 OFFSET ${pagina*5}
        `
      }  
      consulta = `
        SELECT
        publicaciones.id id, titulo, resumen, fecha_hora, pseudonimo, votos, avatar
        FROM publicaciones
        INNER JOIN autores
        ON publicaciones.autor_id = autores.id
        ${modificadorConsulta}
        ORDER BY fecha_hora DESC
        ${modificadorPagina}
      `
        connection.query(consulta, (error, filas, campos)=>{
            res.render('pages/index', {publicaciones: filas, busqueda: busqueda, pagina: pagina});
        });
        connection.release();
    });
});

router.get('/busqueda', function(peticion, res){
  pool.getConnection((error, connection)=>{
    let consulta
    let modificadorConsulta = ""
    const busqueda = ( peticion.query.busqueda ) ? peticion.query.busqueda : ""
    if (busqueda != ""){
      modificadorConsulta = `
        WHERE
        titulo LIKE '%${busqueda}%' OR
        resumen LIKE '%${busqueda}%' OR
        contenido LIKE '%${busqueda}%'
      `
    }
    consulta = `
      SELECT
      publicaciones.id id, titulo, resumen, fecha_hora, pseudonimo, votos, avatar
      FROM publicaciones
      INNER JOIN autores
      ON publicaciones.autor_id = autores.id
      ${modificadorConsulta}
      ORDER BY fecha_hora DESC
    `
      connection.query(consulta, (error, filas, campos)=>{
          res.render('pages/busqueda', {publicaciones: filas, busqueda: busqueda, pagina: 0});
      });
      connection.release();
  });
});

router.get('/registro', function(peticion, res){
    res.render('pages/registro', {mensaje: peticion.flash('mensaje')});
});

router.post('/procesar_registro', function (peticion, res) {
    pool.getConnection(function (err, connection) {
  
      const email = peticion.body.email.toLowerCase().trim()
      const pseudonimo = peticion.body.pseudonimo.trim()
      const contrasena = peticion.body.contrasena
  
      const consultaEmail = `
        SELECT *
        FROM autores
        WHERE email = ${connection.escape(email)}
      `
  
      connection.query(consultaEmail, function (error, filas, campos) {
        if (filas.length > 0) {
          peticion.flash('mensaje', 'Email duplicado - ingrese otro email')
          res.redirect('/registro')
        }
        else {
  
          const consultaPseudonimo = `
            SELECT *
            FROM autores
            WHERE pseudonimo = ${connection.escape(pseudonimo)}
          `
  
          connection.query(consultaPseudonimo, function (error, filas, campos) {
            if (filas.length > 0) {
              peticion.flash('mensaje', 'Pseudonimo duplicado - ingrese otro pseudonimo')
              res.redirect('/registro')
            }
            else {
  
              const consulta = `
                                  INSERT INTO
                                  autores
                                  (email, contrasena, pseudonimo)
                                  VALUES (
                                    ${connection.escape(email)},
                                    ${connection.escape(contrasena)},
                                    ${connection.escape(pseudonimo)}
                                  )
                                `
              connection.query(consulta, function (error, filas, campos) {
                if (peticion.files && peticion.files.avatar){
                  const archivoAvatar = peticion.files.avatar
                  const id = filas.insertId
                  const nombreArchivo = `${id}${path.extname(archivoAvatar.name)}`
                  archivoAvatar.mv(`./public/avatars/${nombreArchivo}`, (error) => {
                    const consultaAvatar = `
                                  UPDATE
                                  autores
                                  SET avatar = ${connection.escape(nombreArchivo)}
                                  WHERE id = ${connection.escape(id)}
                                `
                    connection.query(consultaAvatar, (error, filas, campos) => {
                      enviarCorreoBienvenida(email, pseudonimo)
                      peticion.flash('mensaje', 'Usuario registrado con avatar')
                      respuesta.redirect('/registro')
                    })
                  })
                }
                else {
                  enviarCorreoBienvenida(email, pseudonimo)
                  peticion.flash('mensaje', 'Usuario registrado')
                  res.redirect('/registro')
                }
              })
            }
          })
        }
      })
      connection.release()
    })
  })

router.get('/inicio', function (peticion, res) {
   res.render('pages/inicio', { mensaje: peticion.flash('mensaje') })
})
  
  
router.post('/procesar_inicio', function (peticion, res) {
    pool.getConnection(function (err, connection) {
        const consulta = `
            SELECT *
            FROM autores
            WHERE
            email = ${connection.escape(peticion.body.email)} AND
            contrasena = ${connection.escape(peticion.body.contrasena)}
            `
        connection.query(consulta, function (error, filas, campos) {
        if (filas.length > 0) {
            peticion.session.usuario = filas[0]
            res.redirect('/admin/index')
        }
        else {
            peticion.flash('mensaje', 'Datos inválidos')
            res.redirect('/inicio')
        }
    
        })
        connection.release()
    })
})

router.get('/publicacion/:id', (peticion, respuesta) => {
  pool.getConnection((err, connection) => {
    const consulta = `
      SELECT *
      FROM publicaciones
      WHERE id = ${connection.escape(peticion.params.id)}
    `
    connection.query(consulta, (error, filas, campos) => {
      if (filas.length > 0) {
        respuesta.render('pages/publicacion', { publicacion: filas[0] })
      }
      else {
        respuesta.redirect('/')
      }
    })
    connection.release()
  })
})

router.get('/autores', (peticion, respuesta) => {
  pool.getConnection((err, connection) => {
    const consulta = `
      SELECT autores.id id, pseudonimo, avatar, publicaciones.id publicacion_id, titulo
      FROM autores
      INNER JOIN
      publicaciones
      ON
      autores.id = publicaciones.autor_id
      ORDER BY autores.id DESC, publicaciones.fecha_hora DESC
    `
    connection.query(consulta, (error, filas, campos) => {
      autores = []
      ultimoAutorId = undefined
      filas.forEach(registro => {
        if (registro.id != ultimoAutorId){
          ultimoAutorId = registro.id
          autores.push({
            id: registro.id,
            pseudonimo: registro.pseudonimo,
            avatar: registro.avatar,
            publicaciones: []
          })
        }
        autores[autores.length-1].publicaciones.push({
          id: registro.publicacion_id,
          titulo: registro.titulo
        })
      });
      respuesta.render('pages/autores', { autores: autores })
    })


    connection.release()
  })
})

router.get('/publicacion/:id/votar', (peticion, respuesta) => {
  pool.getConnection((err, connection) => {
    const consulta = `
      SELECT *
      FROM publicaciones
      WHERE id = ${connection.escape(peticion.params.id)}
    `
    connection.query(consulta, (error, filas, campos) => {
      if (filas.length > 0) {
        const consultaVoto = `
          UPDATE publicaciones
          SET
          votos = votos + 1
          WHERE id = ${connection.escape(peticion.params.id)}
        `
        connection.query(consultaVoto, (error, filas, campos) => {
          respuesta.redirect(`/publicacion/${peticion.params.id}`)
        })
      }
      else {
        peticion.flash('mensaje', 'Publicación inválida')
        respuesta.redirect('/')
      }
    })
    connection.release()
  })
})

module.exports = router;