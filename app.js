/* ==========================================================================
   PASO 1: CONEXIÓN A SUPABASE
   ========================================================================== */
const SUPABASE_URL = "https://nlcegrldtsnafytvvaqi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_isjSuro7NLTxsilu6-VL2Q_aHn6GqvY";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let idProductoEditando = null;

/* ==========================================================================
   PASO 2: FUNCIÓN GLOBAL DE NOTIFICACIONES VISUALES NEÓN Y MODAL
   ========================================================================== */
function mostrarNotificacion(mensaje, tipo = "success") {
    const notificacion = document.createElement("div");
    
    const colorFondo = tipo === "success" 
        ? "bg-slate-900/95 border-cyan-400/50 text-cyan-200 shadow-cyan-500/20" 
        : "bg-slate-900/95 border-pink-500/50 text-pink-200 shadow-pink-500/20";
    
    notificacion.className = `fixed bottom-5 right-5 z-50 px-4 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-md text-sm font-medium transition-all duration-300 flex items-center gap-2.5 ${colorFondo}`;
    notificacion.innerHTML = `<span class="text-base">${tipo === "success" ? "✅" : "⚠️"}</span> <span>${mensaje}</span>`;
    
    document.body.appendChild(notificacion);

    setTimeout(() => {
        notificacion.style.opacity = "0";
        notificacion.style.transform = "translateY(8px)";
        setTimeout(() => notificacion.remove(), 300);
    }, 3000);
}

function mostrarConfirmacion(mensaje) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4";

        overlay.innerHTML = `
            <div class="neon-card p-6 rounded-2xl max-w-sm w-full border border-sky-500/30 shadow-2xl space-y-4 text-center">
                <div class="w-12 h-12 mx-auto rounded-2xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-2xl">
                    ⚠️
                </div>
                <h3 class="text-lg font-bold text-sky-400 neon-title">Confirmar acción</h3>
                <p class="text-sm text-slate-300 leading-relaxed">${mensaje}</p>
                <div class="flex gap-3 justify-center pt-2">
                    <button id="btnModalCancelar" type="button" class="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white text-sm font-medium transition">
                        Cancelar
                    </button>
                    <button id="btnModalConfirmar" type="button" class="flex-1 py-2.5 px-4 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 text-sm font-semibold transition flex items-center justify-center gap-1.5">
                        <span>🗑️</span>
                        <span>Eliminar</span>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector("#btnModalCancelar").addEventListener("click", () => {
            overlay.remove();
            resolve(false);
        });

        overlay.querySelector("#btnModalConfirmar").addEventListener("click", () => {
            overlay.remove();
            resolve(true);
        });
    });
}

function escaparAtributo(valor) {
    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function actualizarResumenInventario(productos = []) {
    const elTotal = document.getElementById("statTotalProductos");
    const elStock = document.getElementById("statUnidadesStock");
    const elValor = document.getElementById("statValorInventario");

    const totalProductos = productos.length;
    const totalUnidades = productos.reduce((acc, item) => acc + (Number(item.cantidad) || 0), 0);
    const valorTotal = productos.reduce((acc, item) => acc + ((Number(item.cantidad) || 0) * (Number(item.precio) || 0)), 0);

    if (elTotal) elTotal.textContent = totalProductos;
    if (elStock) elStock.textContent = totalUnidades;
    if (elValor) elValor.textContent = `L${valorTotal.toFixed(2)}`;
}

function actualizarResumenPersonal(listaPersonal = []) {
    const elTotal = document.getElementById("statTotalPersonal");
    const elMasc = document.getElementById("statPersonalMasculino");
    const elFem = document.getElementById("statPersonalFemenino");

    const total = listaPersonal.length;
    const masculino = listaPersonal.filter(p => String(p.genero).toLowerCase() === "masculino").length;
    const femenino = listaPersonal.filter(p => String(p.genero).toLowerCase() === "femenino").length;

    if (elTotal) elTotal.textContent = total;
    if (elMasc) elMasc.textContent = masculino;
    if (elFem) elFem.textContent = femenino;
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

    tableBody.innerHTML = `
        <tr>
            <td colspan="4" class="py-10 text-center text-slate-400">
                <div class="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-800/60 border border-sky-500/20 text-sky-300 text-xs font-medium">
                    <span class="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span>
                    <span>Cargando productos desde Supabase...</span>
                </div>
            </td>
        </tr>
    `;

    const { data: productos, error } = await supabaseClient
        .from('productos')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error("Error al cargar:", error);
        mostrarNotificacion("Error al cargar el inventario: " + error.message, "error");
        tableBody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-rose-400">⚠️ Error al cargar los datos de Inventario.</td></tr>`;
        actualizarResumenInventario([]);
        return;
    }

    actualizarResumenInventario(productos || []);

    if (!productos || productos.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="py-10 text-center text-slate-400">
                    <div class="space-y-1">
                        <p class="text-2xl">📭</p>
                        <p class="font-medium text-slate-300">No hay productos registrados aún</p>
                        <p class="text-xs text-slate-500">Usa el formulario de la izquierda para agregar el primer producto.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = "";

    productos.forEach(producto => {
        const fila = document.createElement("tr");
        fila.className = "border-b border-slate-800/60 hover:bg-sky-500/5 transition-colors duration-150"; 
        
        fila.innerHTML = `
            <td class="py-3.5 px-4 font-medium text-slate-100">${escaparAtributo(producto.nombre)}</td>
            <td class="py-3.5 px-4 font-medium text-slate-300">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                    ${producto.cantidad} uds
                </span>
            </td>
            <td class="py-3.5 px-4 font-semibold text-cyan-400">L${Number(producto.precio).toFixed(2)}</td>
            <td class="py-3.5 px-4 text-center">
                <div class="inline-flex items-center justify-center gap-2">
                    <button type="button"
                            data-id="${producto.id}"
                            data-nombre="${escaparAtributo(producto.nombre)}"
                            data-cantidad="${producto.cantidad}"
                            data-precio="${producto.precio}"
                            onclick="prepararEdicion(Number(this.dataset.id), this.dataset.nombre, Number(this.dataset.cantidad), Number(this.dataset.precio))" 
                            class="inline-flex items-center gap-1 text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2.5 py-1.5 rounded-lg hover:bg-amber-500/20 hover:border-amber-400/50 transition">
                        <span>✏️</span>
                        <span>Editar</span>
                    </button>
                    <button type="button"
                            onclick="eliminarProducto(${producto.id})" 
                            class="inline-flex items-center gap-1 text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 hover:border-rose-400/50 transition">
                        <span>🗑️</span>
                        <span>Eliminar</span>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(fila);
    });
}

function cancelarEdicionProducto() {
    const formulario = document.getElementById("productForm");
    if (formulario) formulario.reset();
    idProductoEditando = null;

    const botonSubmit = document.querySelector("#productForm button[type='submit']");
    if (botonSubmit) botonSubmit.textContent = "Guardar Producto";

    const tituloForm = document.getElementById("formProductoTitulo");
    if (tituloForm) tituloForm.textContent = "Nuevo Producto";

    const btnCancelar = document.getElementById("btnCancelarEdicion");
    if (btnCancelar) btnCancelar.classList.add("hidden");
}

const btnCancelarEdicion = document.getElementById("btnCancelarEdicion");
if (btnCancelarEdicion) {
    btnCancelarEdicion.addEventListener("click", cancelarEdicionProducto);
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
                cancelarEdicionProducto();
                cargarInventario();
            }
        }
    });
}

async function eliminarProducto(id) {
    const confirmado = await mostrarConfirmacion("¿Estás seguro de que deseas eliminar este producto?");
    if (confirmado) {
        const { error } = await supabaseClient
            .from('productos')
            .delete()
            .eq('id', id);

        if (error) {
            mostrarNotificacion("Error al eliminar: " + error.message, "error");
        } else {
            if (idProductoEditando === id) {
                cancelarEdicionProducto();
            }
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
    if (botonSubmit) botonSubmit.textContent = "Actualizar Producto";

    const tituloForm = document.getElementById("formProductoTitulo");
    if (tituloForm) tituloForm.textContent = "Editar Producto";

    const btnCancelar = document.getElementById("btnCancelarEdicion");
    if (btnCancelar) btnCancelar.classList.remove("hidden");

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ==========================================================================
   PASO 5: MÓDULO DE PERSONAL (TABLA: personal)
   ========================================================================== */
async function cargarPersonal() {
    const tableBody = document.getElementById("personalTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="py-10 text-center text-slate-400">
                <div class="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-800/60 border border-sky-500/20 text-sky-300 text-xs font-medium">
                    <span class="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span>
                    <span>Cargando personal desde Supabase...</span>
                </div>
            </td>
        </tr>
    `;

    const { data: listaPersonal, error } = await supabaseClient
        .from('personal')
        .select('*');

    if (error) {
        console.error("Error al cargar personal:", error);
        mostrarNotificacion("Error al cargar personal: " + error.message, "error");
        tableBody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-rose-400">⚠️ Error al cargar los datos de Personal.</td></tr>`;
        actualizarResumenPersonal([]);
        return;
    }

    actualizarResumenPersonal(listaPersonal || []);

    if (!listaPersonal || listaPersonal.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="py-10 text-center text-slate-400">
                    <div class="space-y-1">
                        <p class="text-2xl">👥</p>
                        <p class="font-medium text-slate-300">No hay personal registrado aún</p>
                        <p class="text-xs text-slate-500">Completa el formulario para dar de alta al primer colaborador.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = "";
    listaPersonal.forEach(persona => {
        const fila = document.createElement("tr");
        fila.className = "border-b border-slate-800/60 hover:bg-sky-500/5 transition-colors duration-150";
        fila.innerHTML = `
            <td class="py-3.5 px-4 text-cyan-300 font-semibold whitespace-nowrap">${escaparAtributo(persona.identidad)}</td>
            <td class="py-3.5 px-4 text-slate-100 font-medium">${escaparAtributo(persona.nombres_apellidos)}</td>
            <td class="py-3.5 px-4 text-slate-300">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                    ${escaparAtributo(persona.genero)}
                </span>
            </td>
            <td class="py-3.5 px-4 text-slate-300 whitespace-nowrap">${escaparAtributo(persona.telefono)}</td>
            <td class="py-3.5 px-4 text-slate-400">${escaparAtributo(persona.direccion)}</td>
            <td class="py-3.5 px-4 text-center">
                <button type="button"
                        data-identidad="${escaparAtributo(persona.identidad)}"
                        onclick="eliminarPersonal(this.dataset.identidad)"
                        class="inline-flex items-center gap-1 text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 hover:border-rose-400/50 transition">
                    <span>🗑️</span>
                    <span>Eliminar</span>
                </button>
            </td>
        `;
        tableBody.appendChild(fila);
    });
}

async function eliminarPersonal(identidad) {
    const confirmado = await mostrarConfirmacion("¿Estás seguro de que deseas eliminar este registro de personal?");
    if (confirmado) {
        const { error } = await supabaseClient
            .from('personal')
            .delete()
            .eq('identidad', identidad);

        if (error) {
            mostrarNotificacion("Error al eliminar personal: " + error.message, "error");
        } else {
            mostrarNotificacion("¡Personal eliminado correctamente!", "success");
            cargarPersonal();
        }
    }
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
