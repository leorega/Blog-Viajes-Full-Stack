const express = require('express');
const router = express.Router();
const mysql = require('mysql');

const pool = mysql.createPool({
    connectionLimit: 20,
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'blog_viajes'
});

router.use('/admin/', (peticion, res, siguiente) => {
    if (!peticion.session.usuario) {
      peticion.flash('mensaje', 'Debe iniciar sesión')
      res.redirect("/inicio")
    }
    else {
      siguiente()
    }
  })

  module.exports = router;