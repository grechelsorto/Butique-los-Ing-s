/* ==========================================================================
   PASO 1: CONEXIÓN A SUPABASE
   ========================================================================== */
const SUPABASE_URL = "https://nlcegrldtsnafytvvaqi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_isjSuro7NLTxsilu6-VL2Q_aHn6GqvY";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let idProductoEditando = null;

/* ==========================================================================
   PASO 2: FUNCIÓN GLOBAL DE NOTIFICACIONES VISUALES NEÓN
   ========================================================================== */
function mostrarNotificacion(mensaje, tipo = "success") {
    const notificacion = document.createElement("div");
    
    const colorFondo = tipo === "success" 
        ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-300" 
        : "bg-red-950/90 border-red-500/50 text-red-300";
    
    notificacion.className = `fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur text-sm font-medium transition-all duration-300 ${colorFondo}`;
    notificacion.innerHTML = `<span>${tipo === "success" ? "✅" : "⚠️"}</span> ${mensaje}`;
    
    document.body.appendChild(notificacion);

    setTimeout(() => {
        notificacion.style.opacity = "0";
        setTimeout(() => notificacion.remove(), 300);
    }, 3000);
}

/* ==========================================================================
   PASO 3: MÓDULO DE AUTENTICACIÓN (LOGIN) - PERSONA 1
   ========================================================================== */
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", (evento) => {
        evento.preventDefault();

        const usuario = document.getElementById("usuario").value.trim();
        const password = document.getElementById("password").value.trim();

        // Credenciales de acceso (puedes cambiarlas si deseas)
        if (usuario === "admin" && password === "1234") {
            mostrarNotificacion("¡Acceso concedido! Redirigiendo al inventario...", "success");
            setTimeout(() => {
                window.location.href = "inventario.html";
            }, 1000);
        } else {
            mostrarNotificacion("Usuario o contraseña incorrectos.", "error");
        }
    });
}

/* ==========================================================================
   PASO 4: MÓDULO DE INVENTARIO (TABLA: productos)
   ========================================================================== */
async function cargarInventario() {
    const tableBody = document.getElementById("productTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-500">Cargando datos desde la nube Supabase...</td></tr>`;

    const { data: productos, error } = await supabaseClient
        .from('productos')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error("Error al cargar:", error);
        tableBody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-red-400">Error al cargar los datos de Inventario.</td></tr>`;
        return;
    }

    if (!productos || productos.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-500">No hay productos registrados.</td></tr>`;
        return;
    }

    tableBody.innerHTML = "";

    productos.forEach(producto => {
        const fila = document.createElement("tr");
        fila.className = "border-b border-slate-800/60 hover:bg-slate-800/30 transition"; 
        
        fila.innerHTML = `
            <td class="py-3 px-2 font-medium text-slate-200">${producto.nombre}</td>
            <td class="py-3 px-2 font-medium text-slate-300">${producto.cantidad}</td>
            <td class="py-3 px-2 font-medium text-sky-400">L${Number(producto.precio).toFixed(2)}</td>
            <td class="py-3 px-2 text-center space-x-2">
                <button onclick="prepararEdicion(${producto.id}, '${producto.nombre}', ${producto.cantidad}, ${producto.precio})" 
                        class="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-1 rounded hover:bg-amber-500/20 transition">
                    Editar
                </button>
                <button onclick="eliminarProducto(${producto.id})" 
                        class="text-xs bg-red-500/10 text-red-400 border border-red-500/30 px-2 py-1 rounded hover:bg-red-500/20 transition">
                    Eliminar
                </button>
            </td>
        `;
        tableBody.appendChild(fila);
    });
}

const formulario = document.getElementById("productForm");

if (formulario) {
    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const nombreIngresado = document.getElementById("nombre").value;
        const cantidadIngresada = document.getElementById("cantidad").value;
        const precioIngresado = document.getElementById("precio").value;

        if (idProductoEditando === null) {
            const { error } = await supabaseClient
                .from('productos')
                .insert([{
                    nombre: nombreIngresado,
                    cantidad: parseInt(cantidadIngresada),
                    precio: parseFloat(precioIngresado)
                }]);

            if (error) {
                mostrarNotificacion("Error al guardar: " + error.message, "error");
            } else {
                mostrarNotificacion("¡Producto guardado con éxito en la nube!", "success");
                formulario.reset();
                cargarInventario(); 
            }
        } else {
            const { error } = await supabaseClient
                .from('productos')
                .update({
                    nombre: nombreIngresado,
                    cantidad: parseInt(cantidadIngresada),
                    precio: parseFloat(precioIngresado)
                })
                .eq('id', idProductoEditando);

            if (error) {
                mostrarNotificacion("Error al actualizar: " + error.message, "error");
            } else {
                mostrarNotificacion("¡Producto actualizado con éxito!", "success");
                formulario.reset();
                idProductoEditando = null;
                document.querySelector("#productForm button[type='submit']").textContent = "Guardar Producto";
                cargarInventario();
            }
        }
    });
}

async function eliminarProducto(id) {
    if (confirm("¿Estás seguro de que deseas eliminar este producto?")) {
        const { error } = await supabaseClient
            .from('productos')
            .delete()
            .eq('id', id);

        if (error) {
            mostrarNotificacion("Error al eliminar: " + error.message, "error");
        } else {
            mostrarNotificacion("¡Producto eliminado correctamente!", "success");
            cargarInventario();
        }
    }
}

function prepararEdicion(id, nombre, cantidad, precio) {
    idProductoEditando = id;
    document.getElementById("nombre").value = nombre;
    document.getElementById("cantidad").value = cantidad;
    document.getElementById("precio").value = precio;

    const botonSubmit = document.querySelector("#productForm button[type='submit']");
    botonSubmit.textContent = "Actualizar Producto";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ==========================================================================
   PASO 5: MÓDULO DE PERSONAL (TABLA: personal)
   ========================================================================== */
async function cargarPersonal() {
    const tableBody = document.getElementById("personalTableBody");
    if (!tableBody) return;

    const { data: listaPersonal, error } = await supabaseClient
        .from('personal')
        .select('*');

    if (error) {
        console.error("Error al cargar personal:", error);
        return;
    }

    if (!listaPersonal || listaPersonal.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-500">No hay personal registrado.</td></tr>`;
        return;
    }

    tableBody.innerHTML = "";
    listaPersonal.forEach(persona => {
        const fila = document.createElement("tr");
        fila.className = "border-b border-slate-800/60 hover:bg-slate-800/30 transition";
        fila.innerHTML = `
            <td class="py-3 px-2 text-slate-200">${persona.identidad}</td>
            <td class="py-3 px-2 text-slate-200">${persona.nombres_apellidos}</td>
            <td class="py-3 px-2 text-slate-300">${persona.genero}</td>
            <td class="py-3 px-2 text-slate-300">${persona.telefono}</td>
            <td class="py-3 px-2 text-slate-400">${persona.direccion}</td>
        `;
        tableBody.appendChild(fila);
    });
}

const personalForm = document.getElementById("personalForm");
if (personalForm) {
    personalForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const { error } = await supabaseClient.from('personal').insert([{
            identidad: document.getElementById("identidad").value.trim(),
            nombres_apellidos: document.getElementById("nombres_apellidos").value.trim(),
            genero: document.getElementById("genero").value,
            telefono: document.getElementById("telefono").value.trim(),
            direccion: document.getElementById("direccion").value.trim()
        }]);

        if (error) {
            mostrarNotificacion("Error al registrar personal: " + error.message, "error");
        } else {
            mostrarNotificacion("¡Personal registrado en la nube!", "success");
            personalForm.reset();
            cargarPersonal();
        }
    });
}

/* ==========================================================================
   PASO 6: MÓDULO DE PROVEEDORES (TABLA: proveedores)
   ========================================================================== */
async function cargarProveedores() {
    const tableBody = document.getElementById("proveedoresTableBody");
    if (!tableBody) return;

    const { data: listaProveedores, error } = await supabaseClient
        .from('proveedores')
        .select('*')
        .order('codigo', { ascending: false });

    if (error) {
        console.error("Error al cargar proveedores:", error);
        return;
    }

    if (!listaProveedores || listaProveedores.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-slate-500">No hay proveedores registrados.</td></tr>`;
        return;
    }

    tableBody.innerHTML = "";
    listaProveedores.forEach(prov => {
        const fila = document.createElement("tr");
        fila.className = "border-b border-slate-800/60 hover:bg-slate-800/30 transition";
        fila.innerHTML = `
            <td class="py-3 px-2 text-sky-400 font-bold">#${prov.codigo}</td>
            <td class="py-3 px-2 text-slate-200">${prov.empresa}</td>
            <td class="py-3 px-2 text-slate-300">${prov.encargado}</td>
            <td class="py-3 px-2 text-slate-300">${prov.telefono}</td>
            <td class="py-3 px-2 text-slate-400">${prov.direccion}</td>
            <td class="py-3 px-2 text-slate-400">${prov.correo}</td>
        `;
        tableBody.appendChild(fila);
    });
}

const proveedoresForm = document.getElementById("proveedoresForm");
if (proveedoresForm) {
    proveedoresForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const { error } = await supabaseClient.from('proveedores').insert([{
            empresa: document.getElementById("empresa").value.trim(),
            encargado: document.getElementById("encargado").value.trim(),
            telefono: document.getElementById("telefono_prov").value.trim(),
            direccion: document.getElementById("direccion_prov").value.trim(),
            correo: document.getElementById("correo").value.trim()
        }]);

        if (error) {
            mostrarNotificacion("Error al registrar proveedor: " + error.message, "error");
        } else {
            mostrarNotificacion("¡Proveedor registrado en la nube!", "success");
            proveedoresForm.reset();
            cargarProveedores();
        }
    });
}

/* ==========================================================================
   PASO 7: EJECUCIÓN AUTOMÁTICA AL CARGAR CADA PÁGINA
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("productTableBody")) cargarInventario();
    if (document.getElementById("personalTableBody")) cargarPersonal();
    if (document.getElementById("proveedoresTableBody")) cargarProveedores();
});