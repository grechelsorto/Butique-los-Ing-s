// =====================================================
// app.js  -  Un solo script para index, login e inventario
// =====================================================

// 1) CONEXION A SUPABASE (cambia estos dos valores por los de tu proyecto)
const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU_ANON_KEY';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2) CREDENCIALES DEL LOGIN
const USUARIO_VALIDO = 'admin';
const CLAVE_VALIDA = '1234';

// -----------------------------------------------------
// Utilidades
// -----------------------------------------------------
function esc(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Notificaciones visuales (sin alert() nativo)
function mostrarNotificacion(mensaje, tipo = 'exito') {
  let contenedor = document.getElementById('notificaciones');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'notificaciones';
    contenedor.className = 'fixed top-4 right-4 z-50 space-y-2';
    document.body.appendChild(contenedor);
  }

  const estilos = {
    exito: { icono: '✅', clase: 'border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.5)]' },
    error: { icono: '❌', clase: 'border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.5)]' },
    aviso: { icono: '⚠️', clase: 'border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.5)]' }
  };
  const e = estilos[tipo] || estilos.exito;

  const caja = document.createElement('div');
  caja.className = `flex items-center space-x-3 bg-slate-900 border ${e.clase} rounded-xl px-4 py-3 text-sm font-semibold transition`;
  caja.innerHTML = `<span>${e.icono}</span><span>${esc(mensaje)}</span>`;
  contenedor.appendChild(caja);

  setTimeout(() => {
    caja.style.opacity = '0';
    setTimeout(() => caja.remove(), 300);
  }, 3000);
}

function haySesion() {
  return sessionStorage.getItem('sesion') === 'activa';
}

function cerrarSesion() {
  sessionStorage.removeItem('sesion');
  window.location.href = 'login.html';
}

// -----------------------------------------------------
// LOGIN
// -----------------------------------------------------
function iniciarLogin() {
  if (haySesion()) {
    window.location.href = 'inventario.html';
    return;
  }

  const form = document.getElementById('form-login');
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const usuario = document.getElementById('usuario').value.trim();
    const clave = document.getElementById('clave').value;

    if (usuario === USUARIO_VALIDO && clave === CLAVE_VALIDA) {
      sessionStorage.setItem('sesion', 'activa');
      mostrarNotificacion('Acceso correcto, bienvenido', 'exito');
      setTimeout(() => { window.location.href = 'inventario.html'; }, 800);
    } else {
      mostrarNotificacion('Usuario o contraseña incorrectos', 'error');
    }
  });
}

// -----------------------------------------------------
// INVENTARIO (CRUD con la tabla "productos")
// -----------------------------------------------------
let productos = [];
let idEditando = null;

async function cargarInventario() {
  const { data, error } = await db.from('productos').select('*').order('id', { ascending: true });
  if (error) {
    console.error(error);
    mostrarNotificacion('Error al cargar productos', 'error');
    return;
  }
  productos = data;
  dibujarTabla();
}

function dibujarTabla() {
  const filtro = document.getElementById('buscar').value.trim().toLowerCase();
  const tbody = document.getElementById('tabla-productos');
  const lista = productos.filter(p =>
    p.nombre.toLowerCase().includes(filtro) ||
    (p.categoria || '').toLowerCase().includes(filtro)
  );

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">No hay productos para mostrar 📦</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(p => `
    <tr class="border-b border-slate-800 hover:bg-slate-800/50 transition">
      <td class="p-3">${p.id}</td>
      <td class="p-3 font-semibold">${esc(p.nombre)}</td>
      <td class="p-3">${esc(p.categoria)}</td>
      <td class="p-3">L ${Number(p.precio).toFixed(2)}</td>
      <td class="p-3 ${p.cantidad <= 5 ? 'text-amber-300 font-bold' : ''}">${p.cantidad}${p.cantidad <= 5 ? ' ⚠️' : ''}</td>
      <td class="p-3 whitespace-nowrap">
        <button data-accion="editar" data-id="${p.id}" class="px-3 py-1 rounded-lg border border-sky-400 text-sky-300 hover:bg-sky-400/20 transition">✏️</button>
        <button data-accion="eliminar" data-id="${p.id}" class="px-3 py-1 rounded-lg border border-rose-500 text-rose-300 hover:bg-rose-500/20 transition">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function limpiarFormulario() {
  document.getElementById('form-producto').reset();
  idEditando = null;
  document.getElementById('btn-guardar').innerHTML = '➕ Agregar producto';
  document.getElementById('btn-cancelar').classList.add('hidden');
}

async function guardarProducto(ev) {
  ev.preventDefault();
  const producto = {
    nombre: document.getElementById('nombre').value.trim(),
    categoria: document.getElementById('categoria').value.trim(),
    precio: parseFloat(document.getElementById('precio').value),
    cantidad: parseInt(document.getElementById('cantidad').value, 10)
  };

  if (!producto.nombre || isNaN(producto.precio) || isNaN(producto.cantidad)) {
    mostrarNotificacion('Completa nombre, precio y cantidad', 'aviso');
    return;
  }

  let error;
  if (idEditando === null) {
    ({ error } = await db.from('productos').insert([producto]));            // CREATE
  } else {
    ({ error } = await db.from('productos').update(producto).eq('id', idEditando)); // UPDATE
  }

  if (error) {
    console.error(error);
    mostrarNotificacion('No se pudo guardar el producto', 'error');
    return;
  }

  mostrarNotificacion(idEditando === null ? 'Producto agregado' : 'Producto actualizado', 'exito');
  limpiarFormulario();
  cargarInventario();
}

function prepararEdicion(id) {
  const p = productos.find(x => x.id === id);
  if (!p) return;
  idEditando = id;
  document.getElementById('nombre').value = p.nombre;
  document.getElementById('categoria').value = p.categoria || '';
  document.getElementById('precio').value = p.precio;
  document.getElementById('cantidad').value = p.cantidad;
  document.getElementById('btn-guardar').innerHTML = '💾 Guardar cambios';
  document.getElementById('btn-cancelar').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function eliminarProducto(id) {
  const { error } = await db.from('productos').delete().eq('id', id);           // DELETE
  if (error) {
    console.error(error);
    mostrarNotificacion('No se pudo eliminar', 'error');
    return;
  }
  mostrarNotificacion('Producto eliminado', 'exito');
  cargarInventario();
}

function iniciarInventario() {
  if (!haySesion()) {
    window.location.href = 'login.html';
    return;
  }

  document.getElementById('form-producto').addEventListener('submit', guardarProducto);
  document.getElementById('btn-cancelar').addEventListener('click', limpiarFormulario);
  document.getElementById('buscar').addEventListener('input', dibujarTabla);

  document.getElementById('tabla-productos').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-accion]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (btn.dataset.accion === 'editar') prepararEdicion(id);
    if (btn.dataset.accion === 'eliminar') eliminarProducto(id);
  });

  document.querySelectorAll('.btn-salir').forEach(b => b.addEventListener('click', cerrarSesion));
  cargarInventario();
}

// -----------------------------------------------------
// INDEX
// -----------------------------------------------------
function iniciarIndex() {
  const btn = document.getElementById('btn-entrar');
  btn.addEventListener('click', () => {
    window.location.href = haySesion() ? 'inventario.html' : 'login.html';
  });
}

// -----------------------------------------------------
// Arranque: cada pagina indica cual es con data-page
// -----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const pagina = document.body.dataset.page;
  if (pagina === 'index') iniciarIndex();
  if (pagina === 'login') iniciarLogin();
  if (pagina === 'inventario') iniciarInventario();
});