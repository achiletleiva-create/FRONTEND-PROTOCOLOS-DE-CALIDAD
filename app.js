import React, { useState } from 'react';
import axios from 'axios';

const App = () => {
  const [formData, setFormData] = useState({
    elemento: '', resistencia_fc: '', ubicacion: '',
    slump_pulgadas: '', temperatura_c: '', probetas_cantidad: 2,
    calidad: '', residente: '', supervision: ''
  });
  const [files, setFiles] = useState({});

  const API_URL = "https://backend-protocolos-de-calidad.onrender.com/api/protocolos";

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setFiles({ ...files, [e.target.name]: e.target.files[0] });
  };

  const enviarProtocolo = async (e) => {
    e.preventDefault();
    const data = new FormData();
    
    // Unir datos de texto
    Object.keys(formData).forEach(key => data.append(key, formData[key]));
    // Unir las 6 fotos obligatorias
    Object.keys(files).forEach(key => data.append(key, files[key]));

    try {
      const res = await axios.post(API_URL, data);
      alert(res.data.mensaje);
    } catch (error) {
      alert("Error al subir protocolo");
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto', fontFamily: 'Arial' }}>
      <h2>📋 Registro de Protocolo - Víctor Larco</h2>
      <form onSubmit={enviarProtocolo}>
        <h3>Datos Técnicos</h3>
        <input name="elemento" placeholder="Elemento (ej. Buzón)" onChange={handleInputChange} required />
        <input name="resistencia_fc" placeholder="f'c (kg/cm2)" onChange={handleInputChange} required />
        
        <h3>Ensayos (Norma NTP)</h3>
        <label>Slump (Max 4"): </label>
        <input type="number" name="slump_pulgadas" onChange={handleInputChange} required />
        
        <h3>Registro Fotográfico (Obligatorio)</h3>
        <p>📸 Toma las fotos directamente desde la obra:</p>
        <label>1. Slump con Wincha:</label>
        <input type="file" name="foto_slump" accept="image/*" capture="environment" onChange={handleFileChange} required />
        
        <label>2. Mezclado:</label>
        <input type="file" name="foto_mezclado" accept="image/*" capture="environment" onChange={handleFileChange} required />
        
        <label>3. Encofrado:</label>
        <input type="file" name="foto_encofrado" accept="image/*" capture="environment" onChange={handleFileChange} required />

        <label>4. Probetas:</label>
        <input type="file" name="foto_probetas" accept="image/*" capture="environment" onChange={handleFileChange} required />

        <label>5. Vibrado:</label>
        <input type="file" name="foto_vibrado" accept="image/*" capture="environment" onChange={handleFileChange} required />

        <label>6. Curado:</label>
        <input type="file" name="foto_curado" accept="image/*" capture="environment" onChange={handleFileChange} required />

        <button type="submit" style={{ marginTop: '20px', padding: '10px', width: '100%', backgroundColor: '#28a745', color: 'white' }}>
          Enviar a Base de Datos de Ingeniería
        </button>
      </form>
    </div>
  );
};

export default App;
