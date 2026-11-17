/* ==========================================================================
   PASO 1: CONEXIÓN A SUPABASE
   ========================================================================== */
const SUPABASE_URL = "https://nlcegrldtsnafytvvaqi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_isjSuro7NLTxsilu6-VL2Q_aHn6GqvY";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let idProductoEditando = null;

/* ==========================================================================
   PASO 2: UTILIDADES GLOBALES (ICONOS LUCIDE Y MONEDA)
   ========================================================================== */
function refrescarIconos() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({
            attrs: {
                'stroke-width': 1.75
            }
        });
    }
}

function formatearLempiras(monto) {
    const numero = Number(monto) || 0;
    return `L ${numero.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ==========================================================================
   NOTIFICACIONES VISUALES NEÓN Y MODAL
   ========================================================================== */
function mostrarNotificacion(mensaje, tipo = "success") {
    const notificacion = document.createElement("div");
    
    const colorFondo = tipo === "success" 
        ? "bg-slate-900/95 border-pink-400/50 text-pink-200 shadow-pink-500/20" 
        : "bg-slate-900/95 border-rose-500/50 text-rose-200 shadow-rose-500/20";
    
    const iconoLucide = tipo === "success" ? "check-circle-2" : "alert-triangle";
    const iconoColor = tipo === "success" ? "text-emerald-400" : "text-rose-400";
    
    notificacion.className = `fixed bottom-5 right-5 z-50 px-4 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-md text-sm font-medium transition-all duration-300 flex items-center gap-2.5 ${colorFondo}`;
    notificacion.innerHTML = `<i data-lucide="${iconoLucide}" class="w-5 h-5 shrink-0 ${iconoColor}"></i> <span class="leading-snug">${mensaje}</span>`;
    
    document.body.appendChild(notificacion);
    refrescarIconos();

    setTimeout(() => {
        notificacion.style.opacity = "0";
        notificacion.style.transform = "translateY(8px)";
        setTimeout(() => notificacion.remove(), 300);
    }, 3000);
}

function mostrarConfirmacion(mensaje, textoConfirmar = null) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4";

        const esEliminar = textoConfirmar 
            ? textoConfirmar.toLowerCase().includes("eliminar")
            : (mensaje.toLowerCase().includes("eliminar") || mensaje.toLowerCase().includes("retirar"));

        const btnTexto = textoConfirmar || (esEliminar ? "Eliminar" : "Confirmar");
        const btnIcono = esEliminar ? "trash-2" : "check";
        const modalIcono = esEliminar ? "alert-triangle" : "sparkles";
        const btnClase = esEliminar 
            ? "bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30" 
            : "neon-btn text-white";

        overlay.innerHTML = `
            <div class="neon-card p-6 rounded-2xl max-w-sm w-full border border-pink-500/35 shadow-2xl space-y-4 text-center">
                <div class="w-12 h-12 mx-auto rounded-2xl bg-pink-500/15 border border-pink-500/35 flex items-center justify-center text-pink-400">
                    <i data-lucide="${modalIcono}" class="w-6 h-6"></i>
                </div>
                <h3 class="text-lg font-bold text-pink-400 neon-title">Confirmar acción</h3>
                <p class="text-sm text-slate-300 leading-relaxed">${mensaje}</p>
                <div class="flex gap-3 justify-center pt-2">
                    <button id="btnModalCancelar" type="button" class="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white text-sm font-medium transition flex items-center justify-center gap-1.5">
                        <i data-lucide="x" class="w-4 h-4"></i>
                        <span>Cancelar</span>
                    </button>
                    <button id="btnModalConfirmar" type="button" class="flex-1 py-2.5 px-4 rounded-xl border ${btnClase} text-sm font-semibold transition flex items-center justify-center gap-1.5 shadow-lg">
                        <i data-lucide="${btnIcono}" class="w-4 h-4"></i>
                        <span>${btnTexto}</span>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        refrescarIconos();

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
    if (elValor) elValor.textContent = formatearLempiras(valorTotal);
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
            mostrarNotificacion("¡Bienvenido a Boutique Los Ing's! Redirigiendo al catálogo...", "success");
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
                <div class="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-800/60 border border-pink-500/25 text-pink-300 text-xs font-medium">
                    <i data-lucide="loader-2" class="w-4 h-4 animate-spin text-pink-400"></i>
                    <span>Cargando catálogo de prendas desde Supabase...</span>
                </div>
            </td>
        </tr>
    `;
    refrescarIconos();

    const { data: productos, error } = await supabaseClient
        .from('productos')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error("Error al cargar:", error);
        mostrarNotificacion("Error al cargar el catálogo: " + error.message, "error");
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="py-8 text-center text-rose-400">
                    <div class="inline-flex items-center gap-2">
                        <i data-lucide="alert-triangle" class="w-4 h-4"></i>
                        <span>Error al cargar el catálogo de prendas.</span>
                    </div>
                </td>
            </tr>
        `;
        refrescarIconos();
        actualizarResumenInventario([]);
        return;
    }

    actualizarResumenInventario(productos || []);

    if (!productos || productos.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="py-10 text-center text-slate-400">
                    <div class="space-y-2">
                        <div class="w-12 h-12 mx-auto rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                            <i data-lucide="package-open" class="w-6 h-6"></i>
                        </div>
                        <p class="font-medium text-slate-300">No hay prendas registradas aún</p>
                        <p class="text-xs text-slate-500">Usa el formulario de la izquierda para agregar la primera prenda al catálogo.</p>
                    </div>
                </td>
            </tr>
        `;
        refrescarIconos();
        return;
    }

    tableBody.innerHTML = "";

    productos.forEach(producto => {
        const fila = document.createElement("tr");
        fila.className = "border-b border-slate-800/60 hover:bg-pink-500/5 transition-colors duration-150"; 
        
        fila.innerHTML = `
            <td class="py-3.5 px-4 font-medium text-slate-100">
                <div class="flex items-center gap-2.5">
                    <i data-lucide="shirt" class="w-4 h-4 text-pink-400 shrink-0"></i>
                    <span>${escaparAtributo(producto.nombre)}</span>
                </div>
            </td>
            <td class="py-3.5 px-4 font-medium text-slate-300">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                    ${producto.cantidad} en stock
                </span>
            </td>
            <td class="py-3.5 px-4 font-semibold text-pink-400 whitespace-nowrap">${formatearLempiras(producto.precio)}</td>
            <td class="py-3.5 px-4 text-center">
                <div class="inline-flex items-center justify-center gap-2">
                    <button type="button"
                            data-id="${producto.id}"
                            data-nombre="${escaparAtributo(producto.nombre)}"
                            data-cantidad="${producto.cantidad}"
                            data-precio="${producto.precio}"
                            onclick="prepararEdicion(Number(this.dataset.id), this.dataset.nombre, Number(this.dataset.cantidad), Number(this.dataset.precio))" 
                            class="inline-flex items-center gap-1.5 text-xs font-medium bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/35 px-2.5 py-1.5 rounded-lg hover:bg-fuchsia-500/25 hover:border-fuchsia-400/60 transition">
                        <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                        <span>Editar</span>
                    </button>
                    <button type="button"
                            onclick="eliminarProducto(${producto.id})" 
                            class="inline-flex items-center gap-1.5 text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 hover:border-rose-400/50 transition">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        <span>Eliminar</span>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(fila);
    });

    refrescarIconos();
}

function cancelarEdicionProducto() {
    const formulario = document.getElementById("productForm");
    if (formulario) formulario.reset();
    idProductoEditando = null;

    const botonSubmit = document.querySelector("#productForm button[type='submit']");
    if (botonSubmit) {
        botonSubmit.innerHTML = `
            <i data-lucide="check" class="w-4 h-4"></i>
            <span>Guardar Prenda</span>
        `;
        refrescarIconos();
    }

    const tituloForm = document.getElementById("formProductoTitulo");
    if (tituloForm) tituloForm.textContent = "Nueva Prenda";

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
                mostrarNotificacion("Error al guardar prenda: " + error.message, "error");
            } else {
                mostrarNotificacion("¡Prenda agregada al catálogo en la nube!", "success");
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
                mostrarNotificacion("Error al actualizar prenda: " + error.message, "error");
            } else {
                mostrarNotificacion("¡Prenda actualizada con éxito!", "success");
                cancelarEdicionProducto();
                cargarInventario();
            }
        }
    });
}

async function eliminarProducto(id) {
    const confirmado = await mostrarConfirmacion("¿Estás seguro de que deseas retirar esta prenda del catálogo?");
    if (confirmado) {
        const { error } = await supabaseClient
            .from('productos')
            .delete()
            .eq('id', id);

        if (error) {
            mostrarNotificacion("Error al eliminar prenda: " + error.message, "error");
        } else {
            if (idProductoEditando === id) {
                cancelarEdicionProducto();
            }
            mostrarNotificacion("¡Prenda eliminada del catálogo!", "success");
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
    if (botonSubmit) {
        botonSubmit.innerHTML = `
            <i data-lucide="save" class="w-4 h-4"></i>
            <span>Actualizar Prenda</span>
        `;
        refrescarIconos();
    }

    const tituloForm = document.getElementById("formProductoTitulo");
    if (tituloForm) tituloForm.textContent = "Editar Prenda";

    const btnCancelar = document.getElementById("btnCancelarEdicion");
    if (btnCancelar) btnCancelar.classList.remove("hidden");

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ==========================================================================
   CARGAR PRODUCTOS DE EJEMPLO DE LA BOUTIQUE
   ========================================================================== */
async function cargarProductosEjemplo() {
    const confirmado = await mostrarConfirmacion("¿Cargar 15 productos de ejemplo de la boutique?");
    if (!confirmado) return;

    const productosEjemplo = [
        { nombre: "Vestido de noche satinado - S", cantidad: 8, precio: 1250.00 },
        { nombre: "Vestido casual midi floral - M", cantidad: 14, precio: 780.00 },
        { nombre: "Blusa floral de seda - M", cantidad: 20, precio: 450.00 },
        { nombre: "Camisa clásica blanca ejecutiva - L", cantidad: 15, precio: 520.00 },
        { nombre: "Jeans corte acampanado vintage - 28", cantidad: 18, precio: 690.00 },
        { nombre: "Jeans skinny tiro alto - 30", cantidad: 22, precio: 650.00 },
        { nombre: "Falda plisada elegante - S", cantidad: 12, precio: 490.00 },
        { nombre: "Chaqueta biker cuero sintético - M", cantidad: 9, precio: 1100.00 },
        { nombre: "Abrigo de paño invernal - L", cantidad: 6, precio: 1650.00 },
        { nombre: "Tacones stiletto charol negro - 37", cantidad: 10, precio: 890.00 },
        { nombre: "Sandalias de plataforma doradas - 38", cantidad: 12, precio: 580.00 },
        { nombre: "Bolso tote de cuero para dama - Única", cantidad: 7, precio: 950.00 },
        { nombre: "Bolso bandolera acolchado rosa - Única", cantidad: 11, precio: 720.00 },
        { nombre: "Cinturón de cuero con hebilla dorada - Única", cantidad: 25, precio: 280.00 },
        { nombre: "Bufanda de cachemira estampada - Única", cantidad: 16, precio: 320.00 }
    ];

    const { error } = await supabaseClient
        .from('productos')
        .insert(productosEjemplo);

    if (error) {
        mostrarNotificacion("Error al cargar productos de ejemplo: " + error.message, "error");
    } else {
        mostrarNotificacion("¡15 prendas de ejemplo cargadas con éxito!", "success");
        cargarInventario();
    }
}

const btnCargarEjemplos = document.getElementById("btnCargarEjemplos");
if (btnCargarEjemplos) {
    btnCargarEjemplos.addEventListener("click", cargarProductosEjemplo);
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
                <div class="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-800/60 border border-pink-500/25 text-pink-300 text-xs font-medium">
                    <i data-lucide="loader-2" class="w-4 h-4 animate-spin text-pink-400"></i>
                    <span>Cargando equipo de la boutique desde Supabase...</span>
                </div>
            </td>
        </tr>
    `;
    refrescarIconos();

    const { data: listaPersonal, error } = await supabaseClient
        .from('personal')
        .select('*');

    if (error) {
        console.error("Error al cargar personal:", error);
        mostrarNotificacion("Error al cargar el equipo: " + error.message, "error");
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="py-8 text-center text-rose-400">
                    <div class="inline-flex items-center gap-2">
                        <i data-lucide="alert-triangle" class="w-4 h-4"></i>
                        <span>Error al cargar los datos del Equipo de la Boutique.</span>
                    </div>
                </td>
            </tr>
        `;
        refrescarIconos();
        actualizarResumenPersonal([]);
        return;
    }

    actualizarResumenPersonal(listaPersonal || []);

    if (!listaPersonal || listaPersonal.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="py-10 text-center text-slate-400">
                    <div class="space-y-2">
                        <div class="w-12 h-12 mx-auto rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                            <i data-lucide="user-x" class="w-6 h-6"></i>
                        </div>
                        <p class="font-medium text-slate-300">No hay integrantes en el equipo aún</p>
                        <p class="text-xs text-slate-500">Completa el formulario para registrar al primer asesor o colaborador de la boutique.</p>
                    </div>
                </td>
            </tr>
        `;
        refrescarIconos();
        return;
    }

    tableBody.innerHTML = "";
    listaPersonal.forEach(persona => {
        const fila = document.createElement("tr");
        fila.className = "border-b border-slate-800/60 hover:bg-pink-500/5 transition-colors duration-150";
        fila.innerHTML = `
            <td class="py-3.5 px-4 text-pink-300 font-semibold whitespace-nowrap">${escaparAtributo(persona.identidad)}</td>
            <td class="py-3.5 px-4 text-slate-100 font-medium">${escaparAtributo(persona.nombres_apellidos)}</td>
            <td class="py-3.5 px-4 text-slate-300">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-500/15 text-violet-200 border border-violet-500/30">
                    ${escaparAtributo(persona.genero)}
                </span>
            </td>
            <td class="py-3.5 px-4 text-slate-300 whitespace-nowrap">${escaparAtributo(persona.telefono)}</td>
            <td class="py-3.5 px-4 text-slate-400">${escaparAtributo(persona.direccion)}</td>
            <td class="py-3.5 px-4 text-center">
                <button type="button"
                        data-identidad="${escaparAtributo(persona.identidad)}"
                        onclick="eliminarPersonal(this.dataset.identidad)"
                        class="inline-flex items-center gap-1.5 text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 hover:border-rose-400/50 transition">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    <span>Eliminar</span>
                </button>
            </td>
        `;
        tableBody.appendChild(fila);
    });

    refrescarIconos();
}

async function eliminarPersonal(identidad) {
    const confirmado = await mostrarConfirmacion("¿Estás seguro de que deseas retirar a este integrante del Equipo de la Boutique?");
    if (confirmado) {
        const { error } = await supabaseClient
            .from('personal')
            .delete()
            .eq('identidad', identidad);

        if (error) {
            mostrarNotificacion("Error al eliminar integrante: " + error.message, "error");
        } else {
            mostrarNotificacion("¡Integrante retirado del equipo correctamente!", "success");
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
            mostrarNotificacion("Error al registrar colaborador: " + error.message, "error");
        } else {
            mostrarNotificacion("¡Colaborador registrado en el Equipo de la Boutique!", "success");
            personalForm.reset();
            cargarPersonal();
        }
    });
}

/* ==========================================================================
   PASO 6: MÓDULO DE PROVEEDORES (TABLA: proveedores)
   ========================================================================== */

// Variable para identificar el proveedor que se está editando
let proveedorEnEdicionId = null;


// ==========================================================================
// 1. CARGAR Y MOSTRAR PROVEEDORES
// ==========================================================================

async function cargarProveedores() {
    const tableBody = document.getElementById("proveedoresTableBody");

    if (!tableBody) return;

    const { data: listaProveedores, error } = await supabaseClient
        .from("proveedores")
        .select("*")
        .order("codigo", { ascending: false });

    if (error) {
        console.error("Error al cargar proveedores:", error);
        mostrarNotificacion(
            "Error al cargar proveedores: " + error.message,
            "error"
        );
        return;
    }

    if (!listaProveedores || listaProveedores.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-slate-400">
                    <div class="space-y-2">
                        <div class="w-12 h-12 mx-auto rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                            <i data-lucide="truck" class="w-6 h-6"></i>
                        </div>
                        <p class="font-medium text-slate-300">No hay proveedores registrados aún.</p>
                    </div>
                </td>
            </tr>
        `;
        refrescarIconos();
        return;
    }

    tableBody.innerHTML = "";

    listaProveedores.forEach(prov => {
        const fila = document.createElement("tr");

        fila.className =
            "border-b border-slate-800/60 hover:bg-slate-800/30 transition";

        fila.innerHTML = `
            <td class="py-3 px-2 text-sky-400 font-bold">
                #${prov.codigo}
            </td>

            <td class="py-3 px-2 text-slate-200"></td>
            <td class="py-3 px-2 text-slate-300"></td>
            <td class="py-3 px-2 text-slate-300"></td>
            <td class="py-3 px-2 text-slate-400"></td>
            <td class="py-3 px-2 text-slate-400"></td>

            <td class="py-3 px-2 text-center">
                <div class="inline-flex items-center justify-center gap-2">

                    <button
                        type="button"
                        data-accion="editar"
                        data-id="${prov.codigo}"
                        class="inline-flex items-center gap-1.5 text-xs font-medium bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/35 px-2.5 py-1.5 rounded-lg hover:bg-fuchsia-500/25 transition">
                        <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                        <span>Editar</span>
                    </button>

                    <button
                        type="button"
                        data-accion="eliminar"
                        data-id="${prov.codigo}"
                        class="inline-flex items-center gap-1.5 text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 transition">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        <span>Eliminar</span>
                    </button>

                </div>
            </td>
        `;

        const celdas = fila.querySelectorAll("td");

        celdas[1].textContent = prov.empresa || "";
        celdas[2].textContent = prov.encargado || "";
        celdas[3].textContent = prov.telefono || "";
        celdas[4].textContent = prov.direccion || "";
        celdas[5].textContent = prov.correo || "";

        tableBody.appendChild(fila);
    });

    refrescarIconos();
}


// ==========================================================================
// 2. REGISTRAR Y ACTUALIZAR PROVEEDORES
// ==========================================================================

const proveedoresForm = document.getElementById("proveedoresForm");

if (proveedoresForm) {

    proveedoresForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const proveedor = {
            empresa: document.getElementById("empresa").value.trim(),
            encargado: document.getElementById("encargado").value.trim(),
            telefono: document.getElementById("telefono_prov").value.trim(),
            direccion: document.getElementById("direccion_prov").value.trim(),
            correo: document.getElementById("correo").value.trim()
        };

        let resultado;

        // ACTUALIZAR PROVEEDOR
        if (proveedorEnEdicionId !== null) {

            resultado = await supabaseClient
                .from("proveedores")
                .update(proveedor)
                .eq("codigo", proveedorEnEdicionId);

        } else {

            // REGISTRAR NUEVO PROVEEDOR
            resultado = await supabaseClient
                .from("proveedores")
                .insert([proveedor]);

        }

        if (resultado.error) {
            mostrarNotificacion(
                "Error al guardar proveedor: " + resultado.error.message,
                "error"
            );
            return;
        }

        if (proveedorEnEdicionId !== null) {
            mostrarNotificacion(
                "Proveedor actualizado correctamente.",
                "success"
            );
        } else {
            mostrarNotificacion(
                "Proveedor registrado correctamente.",
                "success"
            );
        }

        cancelarEdicionProveedor();
        await cargarProveedores();
    });
}


// ==========================================================================
// 3. BOTONES DE EDITAR Y ELIMINAR
// ==========================================================================

const proveedoresTableBody = document.getElementById(
    "proveedoresTableBody"
);

if (proveedoresTableBody) {

    proveedoresTableBody.addEventListener("click", async (e) => {

        const boton = e.target.closest("button[data-accion]");

        if (!boton) return;

        const codigo = boton.dataset.id;
        const accion = boton.dataset.accion;


        // ------------------------------------------------------------------
        // EDITAR PROVEEDOR
        // ------------------------------------------------------------------

        if (accion === "editar") {

            const { data, error } = await supabaseClient
                .from("proveedores")
                .select("*")
                .eq("codigo", codigo)
                .single();

            if (error) {
                mostrarNotificacion(
                    "Error al buscar proveedor: " + error.message,
                    "error"
                );
                return;
            }

            proveedorEnEdicionId = codigo;

            document.getElementById("empresa").value =
                data.empresa || "";

            document.getElementById("encargado").value =
                data.encargado || "";

            document.getElementById("telefono_prov").value =
                data.telefono || "";

            document.getElementById("direccion_prov").value =
                data.direccion || "";

            document.getElementById("correo").value =
                data.correo || "";


            const titulo = document.getElementById("tituloProveedor");

            if (titulo) {
                titulo.textContent = "Editar proveedor";
            }


            const botonGuardar = document.getElementById(
                "btnGuardarProveedor"
            );

            if (botonGuardar) {
                botonGuardar.innerHTML = `
                    <i data-lucide="save" class="w-4 h-4"></i>
                    <span>Actualizar proveedor</span>
                `;
                refrescarIconos();
            }


            const botonCancelar = document.getElementById(
                "btnCancelarProveedor"
            );

            if (botonCancelar) {
                botonCancelar.classList.remove("hidden");
            }
        }


        // ------------------------------------------------------------------
        // ELIMINAR PROVEEDOR
        // ------------------------------------------------------------------

        if (accion === "eliminar") {

            const confirmar = await mostrarConfirmacion(
                "¿Estás seguro de eliminar este proveedor?"
            );

            if (!confirmar) return;

            const { error } = await supabaseClient
                .from("proveedores")
                .delete()
                .eq("codigo", codigo);

            if (error) {
                mostrarNotificacion(
                    "Error al eliminar proveedor: " + error.message,
                    "error"
                );
                return;
            }

            mostrarNotificacion(
                "Proveedor eliminado correctamente.",
                "success"
            );

            await cargarProveedores();
        }

    });
}


// ==========================================================================
// 4. CANCELAR EDICIÓN
// ==========================================================================

function cancelarEdicionProveedor() {

    proveedorEnEdicionId = null;

    if (proveedoresForm) {
        proveedoresForm.reset();
    }

    const titulo = document.getElementById("tituloProveedor");

    if (titulo) {
        titulo.textContent = "Registrar proveedor";
    }

    const botonGuardar = document.getElementById(
        "btnGuardarProveedor"
    );

    if (botonGuardar) {
        botonGuardar.innerHTML = `
            <i data-lucide="check" class="w-4 h-4"></i>
            <span>Registrar proveedor</span>
        `;
        refrescarIconos();
    }

    const botonCancelar = document.getElementById(
        "btnCancelarProveedor"
    );

    if (botonCancelar) {
        botonCancelar.classList.add("hidden");
    }
}


// ==========================================================================
// 5. EVENTO DEL BOTÓN CANCELAR
// ==========================================================================

const btnCancelarProveedor = document.getElementById(
    "btnCancelarProveedor"
);

if (btnCancelarProveedor) {
    btnCancelarProveedor.addEventListener(
        "click",
        cancelarEdicionProveedor
    );
}



/* ==========================================================================
   PASO 7: CATÁLOGO PÚBLICO PARA CLIENTES (index.html)
   ========================================================================== */
let catalogoPrendasPublico = [];

async function cargarCatalogoPublico() {
    const contenedor = document.getElementById("catalogoPublicoGrid");
    if (!contenedor) return;

    contenedor.innerHTML = `
        <div class="col-span-full py-16 text-center text-slate-400">
            <div class="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-800/60 border border-pink-500/25 text-pink-300 text-xs font-medium">
                <i data-lucide="loader-2" class="w-4 h-4 animate-spin text-pink-400"></i>
                <span>Cargando colección de prendas...</span>
            </div>
        </div>
    `;
    refrescarIconos();

    const { data: productos, error } = await supabaseClient
        .from('productos')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error("Error al cargar catálogo público:", error);
        contenedor.innerHTML = `
            <div class="col-span-full py-12 text-center text-rose-400">
                <div class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30">
                    <i data-lucide="alert-triangle" class="w-4 h-4"></i>
                    <span>No se pudo cargar la colección de prendas en este momento.</span>
                </div>
            </div>
        `;
        refrescarIconos();
        return;
    }

    catalogoPrendasPublico = productos || [];
    renderizarCatalogoPublico(catalogoPrendasPublico);
}

function renderizarCatalogoPublico(prendas) {
    const contenedor = document.getElementById("catalogoPublicoGrid");
    if (!contenedor) return;

    if (!prendas || prendas.length === 0) {
        contenedor.innerHTML = `
            <div class="col-span-full py-16 text-center text-slate-400">
                <div class="space-y-2 max-w-sm mx-auto">
                    <div class="w-12 h-12 mx-auto rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                        <i data-lucide="search-x" class="w-6 h-6"></i>
                    </div>
                    <p class="font-medium text-slate-300">No se encontraron prendas</p>
                    <p class="text-xs text-slate-500">Intenta con otro término de búsqueda o revisa más tarde nuestras novedades.</p>
                </div>
            </div>
        `;
        refrescarIconos();
        return;
    }

    contenedor.innerHTML = "";

    prendas.forEach(prenda => {
        const cantidad = Number(prenda.cantidad) || 0;
        let badgeHtml = "";

        if (cantidad <= 0) {
            badgeHtml = `
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                    <i data-lucide="ban" class="w-3 h-3"></i>
                    <span>Agotado</span>
                </span>
            `;
        } else if (cantidad <= 5) {
            badgeHtml = `
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <i data-lucide="clock" class="w-3 h-3"></i>
                    <span>Pocas unidades (${cantidad})</span>
                </span>
            `;
        } else {
            badgeHtml = `
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <i data-lucide="check" class="w-3 h-3"></i>
                    <span>Disponible</span>
                </span>
            `;
        }

        const tarjeta = document.createElement("article");
        tarjeta.className = "neon-card p-5 rounded-2xl flex flex-col justify-between group transition-all duration-300 hover:-translate-y-1";

        tarjeta.innerHTML = `
            <div>
                <div class="flex items-start justify-between gap-2 mb-4">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-violet-500/20 border border-pink-400/30 flex items-center justify-center text-pink-400 group-hover:border-pink-400/60 transition shadow-lg shadow-pink-500/10">
                        <i data-lucide="shirt" class="w-5 h-5"></i>
                    </div>
                    ${badgeHtml}
                </div>

                <h3 class="text-base font-bold text-slate-100 group-hover:text-pink-300 transition leading-snug">
                    ${escaparAtributo(prenda.nombre)}
                </h3>
            </div>

            <div class="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                    <p class="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Precio</p>
                    <p class="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-fuchsia-400">
                        ${formatearLempiras(prenda.precio)}
                    </p>
                </div>
                <div class="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400/70 group-hover:text-pink-300 group-hover:border-pink-400/40 transition">
                    <i data-lucide="sparkles" class="w-4 h-4"></i>
                </div>
            </div>
        `;

        contenedor.appendChild(tarjeta);
    });

    refrescarIconos();
}

function filtrarCatalogoPublico(termino) {
    const query = String(termino || "").toLowerCase().trim();
    if (!query) {
        renderizarCatalogoPublico(catalogoPrendasPublico);
        return;
    }
    const filtrados = catalogoPrendasPublico.filter(item => 
        String(item.nombre || "").toLowerCase().includes(query)
    );
    renderizarCatalogoPublico(filtrados);
}

const inputBusquedaCatalogo = document.getElementById("inputBusquedaCatalogo");
if (inputBusquedaCatalogo) {
    inputBusquedaCatalogo.addEventListener("input", (e) => {
        filtrarCatalogoPublico(e.target.value);
    });
}

/* ==========================================================================
   PASO 8: EJECUCIÓN AUTOMÁTICA AL CARGAR CADA PÁGINA
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
    refrescarIconos();
    if (document.getElementById("catalogoPublicoGrid")) cargarCatalogoPublico();
    if (document.getElementById("productTableBody")) cargarInventario();
    if (document.getElementById("personalTableBody")) cargarPersonal();
    if (document.getElementById("proveedoresTableBody")) cargarProveedores();
});
