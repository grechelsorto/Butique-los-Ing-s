/* ==========================================================================
   BOUTIQUE LOS ING'S - SISTEMA WEB INTEGRAL
   Conexión a Supabase, Autenticación RBAC, Inventario, Personal y Proveedores
   ========================================================================== */

/* ==========================================================================
   PASO 1: CONEXIÓN A SUPABASE
   ========================================================================== */
const SUPABASE_URL = "https://nlcegrldtsnafytvvaqi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_isjSuro7NLTxsilu6-VL2Q_aHn6GqvY";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let idProductoEditando = null;
let proveedorEnEdicionId = null;
let catalogoPrendasPublico = [];

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

function escaparAtributo(valor) {
    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/* ==========================================================================
   NOTIFICACIONES VISUALES NEÓN Y MODAL DE CONFIRMACIÓN
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
    }, 3200);
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

/* ==========================================================================
   PASO 3: CONTROL DE ACCESO POR ROLES (RBAC) Y SESIÓN
   Roles permitidos: admin, encargado_inventario, encargado_proveedores, asesor
   ========================================================================== */

function obtenerNombreRol(rol) {
    switch (rol) {
        case "admin":
            return "Administrador";
        case "encargado_inventario":
            return "Encargado de Inventario";
        case "encargado_proveedores":
            return "Encargado de Proveedores";
        case "asesor":
            return "Asesor de Moda";
        default:
            return rol || "Usuario";
    }
}

function protegerPagina(rolesPermitidos = []) {
    const usuario = sessionStorage.getItem("usuario");
    const rol = sessionStorage.getItem("rol");

    if (!usuario || !rol) {
        window.location.replace("login.html");
        return false;
    }

    if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(rol)) {
        let destino = "inventario.html";
        if (rol === "encargado_proveedores") {
            destino = "proveedores.html";
        } else if (rol === "encargado_inventario" || rol === "asesor") {
            destino = "inventario.html";
        } else if (rol === "admin") {
            destino = "inventario.html";
        } else {
            destino = "login.html";
        }
        window.location.replace(destino);
        return false;
    }

    return true;
}

function verificarSesionEnLogin() {
    const usuario = sessionStorage.getItem("usuario");
    const rol = sessionStorage.getItem("rol");
    if (usuario && rol) {
        if (rol === "encargado_proveedores") {
            window.location.replace("proveedores.html");
        } else {
            window.location.replace("inventario.html");
        }
    }
}

function cerrarSesion() {
    sessionStorage.clear();
    window.location.href = "index.html";
}

function configurarSidebarYHeader() {
    const usuario = sessionStorage.getItem("usuario");
    const rol = sessionStorage.getItem("rol");
    const nombre = sessionStorage.getItem("nombre") || usuario;

    // Actualizar encabezado si existen los elementos
    const elHeaderNombre = document.getElementById("headerUsuarioNombre");
    const elHeaderRol = document.getElementById("headerUsuarioRol");
    if (elHeaderNombre && usuario) {
        elHeaderNombre.textContent = nombre;
    }
    if (elHeaderRol && rol) {
        elHeaderRol.textContent = obtenerNombreRol(rol);
    }

    // Filtrar enlaces del sidebar y menú móvil según el rol
    if (rol) {
        const linkPersonal = document.getElementById("linkNavPersonal");
        const linkPersonalMobile = document.getElementById("linkNavPersonalMobile");
        const linkProveedores = document.getElementById("linkNavProveedores");
        const linkProveedoresMobile = document.getElementById("linkNavProveedoresMobile");

        // Solo admin puede acceder a personal
        if (rol !== "admin") {
            if (linkPersonal) linkPersonal.classList.add("hidden");
            if (linkPersonalMobile) linkPersonalMobile.classList.add("hidden");
        }

        // Solo admin y encargado_proveedores pueden acceder a proveedores
        if (rol !== "admin" && rol !== "encargado_proveedores") {
            if (linkProveedores) linkProveedores.classList.add("hidden");
            if (linkProveedoresMobile) linkProveedoresMobile.classList.add("hidden");
        }
    }
}

function aplicarPermisosInventario() {
    const rol = sessionStorage.getItem("rol");
    if (!rol) return;

    const esSoloLectura = (rol === "encargado_proveedores" || rol === "asesor");

    const colFormulario = document.getElementById("columnaFormularioInventario");
    const colTabla = document.getElementById("columnaTablaInventario");
    const bannerLectura = document.getElementById("bannerSoloLecturaInventario");
    const btnEjemplos = document.getElementById("btnCargarEjemplos");
    const thAcciones = document.getElementById("thAccionesInventario");

    if (esSoloLectura) {
        if (colFormulario) {
            colFormulario.classList.add("hidden");
        }
        if (colTabla) {
            colTabla.classList.remove("lg:col-span-2");
            colTabla.classList.add("lg:col-span-3", "w-full");
        }
        if (bannerLectura) {
            bannerLectura.classList.remove("hidden");
        }
        if (btnEjemplos) {
            btnEjemplos.classList.add("hidden");
        }
        if (thAcciones) {
            thAcciones.innerHTML = `<span>Permiso</span>`;
        }
    }
}

function restaurarBotonLogin() {
    const btnLogin = document.getElementById("btnLogin");
    if (btnLogin) {
        btnLogin.disabled = false;
        btnLogin.innerHTML = `<i data-lucide="log-in" class="w-4 h-4"></i> <span>Entrar al Panel de la Boutique</span>`;
        refrescarIconos();
    }
}

/* ==========================================================================
   PASO 4: MÓDULO DE INVENTARIO (TABLA: productos)
   ========================================================================== */
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

    console.log("Cargando inventario de productos desde Supabase...");
    const { data: productos, error } = await supabaseClient
        .from('productos')
        .select('*')
        .order('id', { ascending: false });

    console.log("Resultado carga inventario:", productos, "Error:", error);

    if (error) {
        console.error("Error al cargar inventario:", error);
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
                        <p class="text-xs text-slate-500">Usa el formulario para agregar la primera prenda al catálogo.</p>
                    </div>
                </td>
            </tr>
        `;
        refrescarIconos();
        return;
    }

    const rolActual = sessionStorage.getItem("rol");
    const esSoloLectura = (rolActual === "encargado_proveedores" || rolActual === "asesor");

    tableBody.innerHTML = "";

    productos.forEach(producto => {
        const fila = document.createElement("tr");
        fila.className = "border-b border-slate-800/60 hover:bg-pink-500/5 transition-colors duration-150";

        let celdaAcciones = "";
        if (esSoloLectura) {
            celdaAcciones = `
                <span class="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-800/60 border border-slate-700/50 px-2.5 py-1 rounded-lg">
                    <i data-lucide="eye" class="w-3.5 h-3.5 text-slate-400"></i>
                    <span>Solo Lectura</span>
                </span>
            `;
        } else {
            celdaAcciones = `
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
            `;
        }
        
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
                ${celdaAcciones}
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

async function eliminarProducto(id) {
    const rolActual = sessionStorage.getItem("rol");
    if (rolActual !== "admin" && rolActual !== "encargado_inventario") {
        mostrarNotificacion("Permiso denegado: Tu rol no permite eliminar prendas del catálogo.", "error");
        return;
    }

    const confirmado = await mostrarConfirmacion("¿Estás seguro de que deseas retirar esta prenda del catálogo?");
    if (confirmado) {
        console.log("Eliminando producto id:", id);
        const { error } = await supabaseClient
            .from('productos')
            .delete()
            .eq('id', id);

        console.log("Resultado eliminar producto:", error);

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
    const rolActual = sessionStorage.getItem("rol");
    if (rolActual !== "admin" && rolActual !== "encargado_inventario") {
        mostrarNotificacion("Permiso denegado: No tienes permisos para editar prendas.", "error");
        return;
    }

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

async function cargarProductosEjemplo() {
    const rolActual = sessionStorage.getItem("rol");
    if (rolActual !== "admin" && rolActual !== "encargado_inventario") {
        mostrarNotificacion("Permiso denegado: Solo el Administrador o Encargado de Inventario pueden cargar ejemplos.", "error");
        return;
    }

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

    console.log("Insertando productos de ejemplo en Supabase...");
    const { error } = await supabaseClient
        .from('productos')
        .insert(productosEjemplo);

    console.log("Resultado insertar ejemplos:", error);

    if (error) {
        mostrarNotificacion("Error al cargar productos de ejemplo: " + error.message, "error");
    } else {
        mostrarNotificacion("¡15 prendas de ejemplo cargadas con éxito!", "success");
        cargarInventario();
    }
}

/* ==========================================================================
   PASO 5: MÓDULO DE PERSONAL (TABLA: personal) - SOLO ADMIN
   ========================================================================== */
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

    console.log("Cargando personal desde Supabase...");
    const { data: listaPersonal, error } = await supabaseClient
        .from('personal')
        .select('*');

    console.log("Resultado carga personal:", listaPersonal, "Error:", error);

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
                        <p class="text-xs text-slate-500">Completa el formulario para registrar al primer colaborador de la boutique.</p>
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
    const rolActual = sessionStorage.getItem("rol");
    if (rolActual !== "admin") {
        mostrarNotificacion("Permiso denegado: Solo el Administrador puede retirar colaboradores.", "error");
        return;
    }

    const confirmado = await mostrarConfirmacion("¿Estás seguro de que deseas retirar a este integrante del Equipo de la Boutique?");
    if (confirmado) {
        console.log("Eliminando personal con identidad:", identidad);
        const { error } = await supabaseClient
            .from('personal')
            .delete()
            .eq('identidad', identidad);

        console.log("Resultado eliminar personal:", error);

        if (error) {
            mostrarNotificacion("Error al eliminar integrante: " + error.message, "error");
        } else {
            mostrarNotificacion("¡Integrante retirado del equipo correctamente!", "success");
            cargarPersonal();
            cargarSelectEmpleados();
            cargarUsuarios();
        }
    }
}

/* ==========================================================================
   PASO 6: GESTIÓN DE CUENTAS DE USUARIOS (TABLA: usuarios) - SOLO ADMIN
   Columnas: usuario (PK), password, rol, identidad (FK)
   Roles: admin, encargado_inventario, encargado_proveedores, asesor
   ========================================================================== */
async function cargarSelectEmpleados() {
    const select = document.getElementById("nuevoEmpleadoIdentidad");
    if (!select) return;

    console.log("Consultando personal para cargarSelectEmpleados()...");
    const { data: empleados, error } = await supabaseClient
        .from('personal')
        .select('identidad, nombres_apellidos')
        .order('nombres_apellidos', { ascending: true });

    console.log("Resultado select empleados:", empleados, "Error:", error);

    if (error) {
        console.error("Error al cargar selector de empleados:", error);
        return;
    }

    select.innerHTML = `<option value="">-- Sin vincular a colaborador --</option>`;

    if (empleados && empleados.length > 0) {
        empleados.forEach(emp => {
            const opt = document.createElement("option");
            opt.value = emp.identidad;
            opt.textContent = `${emp.nombres_apellidos} (${emp.identidad})`;
            select.appendChild(opt);
        });
    }
}

async function cargarUsuarios() {
    const tableBody = document.getElementById("usuariosTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="4" class="py-8 text-center text-slate-400">
                <div class="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-800/60 border border-pink-500/25 text-pink-300 text-xs font-medium">
                    <i data-lucide="loader-2" class="w-4 h-4 animate-spin text-pink-400"></i>
                    <span>Cargando cuentas de usuario desde Supabase...</span>
                </div>
            </td>
        </tr>
    `;
    refrescarIconos();

    console.log("Ejecutando cargarUsuarios(). Consultando tabla 'usuarios'...");

    try {
        const { data: usuarios, error } = await supabaseClient
            .from('usuarios')
            .select('*')
            .order('usuario', { ascending: true });

        console.log("Resultado consulta usuarios (cargarUsuarios):", usuarios);
        console.log("Error consulta usuarios (cargarUsuarios):", error);

        if (error) {
            console.error("Error devuelto por Supabase al cargar usuarios:", error);
            mostrarNotificacion("Error al cargar usuarios: " + (error.message || JSON.stringify(error)), "error");
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="py-8 text-center">
                        <div class="inline-flex flex-col items-center gap-2 max-w-md mx-auto p-4 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 shadow-xl">
                            <div class="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                                <i data-lucide="alert-triangle" class="w-5 h-5 shrink-0"></i>
                                <span>Error al consultar la tabla usuarios en Supabase</span>
                            </div>
                            <p class="text-xs text-rose-200 font-mono break-all">${escaparAtributo(error.message || JSON.stringify(error))}</p>
                            ${error.hint ? `<p class="text-[11px] text-slate-400">Pista: ${escaparAtributo(error.hint)}</p>` : ''}
                            ${error.details ? `<p class="text-[11px] text-slate-400">Detalles: ${escaparAtributo(error.details)}</p>` : ''}
                        </div>
                    </td>
                </tr>
            `;
            refrescarIconos();
            return;
        }

        // Consultar nombres de personal para asociar nombres reales
        console.log("Consultando tabla personal para cruzar colaboradores...");
        const { data: listaPersonal, error: errorPersonal } = await supabaseClient
            .from('personal')
            .select('identidad, nombres_apellidos');

        console.log("Resultado consulta personal (cargarUsuarios):", listaPersonal);
        console.log("Error consulta personal (cargarUsuarios):", errorPersonal);

        const mapaPersonal = {};
        if (listaPersonal) {
            listaPersonal.forEach(p => {
                mapaPersonal[p.identidad] = p.nombres_apellidos;
            });
        }

        if (!usuarios || usuarios.length === 0) {
            console.log("No hay usuarios registrados en la tabla 'usuarios'.");
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="py-10 text-center text-slate-400">
                        <div class="space-y-2">
                            <div class="w-10 h-10 mx-auto rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                                <i data-lucide="user-x" class="w-5 h-5"></i>
                            </div>
                            <p class="font-medium text-slate-300 text-sm">No hay cuentas de usuario registradas aún</p>
                            <p class="text-xs text-slate-500">Usa el formulario de la izquierda para crear la primera cuenta de acceso.</p>
                        </div>
                    </td>
                </tr>
            `;
            refrescarIconos();
            return;
        }

        const usuarioLogueado = sessionStorage.getItem("usuario");
        tableBody.innerHTML = "";

        usuarios.forEach(u => {
            const fila = document.createElement("tr");
            fila.className = "border-b border-slate-800/60 hover:bg-pink-500/5 transition-colors duration-150";

            let rolBadge = "";
            if (u.rol === "admin") {
                rolBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-500/15 text-pink-300 border border-pink-500/35"><i data-lucide="shield" class="w-3 h-3"></i>Administrador</span>`;
            } else if (u.rol === "encargado_inventario") {
                rolBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/35"><i data-lucide="shirt" class="w-3 h-3"></i>Encargado Inventario</span>`;
            } else if (u.rol === "encargado_proveedores") {
                rolBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/35"><i data-lucide="truck" class="w-3 h-3"></i>Encargado Proveedores</span>`;
            } else {
                rolBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35"><i data-lucide="tag" class="w-3 h-3"></i>Asesor de Moda</span>`;
            }

            let colaboradorTexto = `<span class="text-xs text-slate-500 italic">Sin vincular</span>`;
            if (u.identidad) {
                const nombreReal = mapaPersonal[u.identidad] || "Colaborador";
                colaboradorTexto = `
                    <div>
                        <span class="text-sm font-medium text-slate-200 block">${escaparAtributo(nombreReal)}</span>
                        <span class="text-[11px] text-pink-300/80 font-mono">${escaparAtributo(u.identidad)}</span>
                    </div>
                `;
            }

            let celdaAccion = "";
            if (u.usuario === usuarioLogueado) {
                celdaAccion = `
                    <span class="inline-flex items-center gap-1 text-[11px] text-pink-400 bg-pink-500/10 border border-pink-500/30 px-2 py-1 rounded-lg font-medium">
                        <i data-lucide="user-check" class="w-3 h-3"></i>
                        <span>Sesión actual</span>
                    </span>
                `;
            } else {
                celdaAccion = `
                    <button type="button"
                            data-usuario="${escaparAtributo(u.usuario)}"
                            onclick="eliminarUsuario(this.dataset.usuario)"
                            class="inline-flex items-center gap-1.5 text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 hover:border-rose-400/50 transition">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        <span>Eliminar</span>
                    </button>
                `;
            }

            fila.innerHTML = `
                <td class="py-3.5 px-4 font-semibold text-slate-100 whitespace-nowrap">
                    <div class="flex items-center gap-2">
                        <i data-lucide="user" class="w-4 h-4 text-pink-400"></i>
                        <span>${escaparAtributo(u.usuario)}</span>
                    </div>
                </td>
                <td class="py-3.5 px-4">${rolBadge}</td>
                <td class="py-3.5 px-4">${colaboradorTexto}</td>
                <td class="py-3.5 px-4 text-center">${celdaAccion}</td>
            `;

            tableBody.appendChild(fila);
        });

        refrescarIconos();

    } catch (errEx) {
        console.error("Excepción inesperada en cargarUsuarios:", errEx);
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="py-8 text-center">
                    <div class="inline-flex flex-col items-center gap-2 max-w-md mx-auto p-4 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 shadow-xl">
                        <div class="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                            <i data-lucide="alert-triangle" class="w-5 h-5 shrink-0"></i>
                            <span>Error inesperado al cargar usuarios</span>
                        </div>
                        <p class="text-xs text-rose-200 font-mono break-all">${escaparAtributo(errEx.message || errEx)}</p>
                    </div>
                </td>
            </tr>
        `;
        refrescarIconos();
        mostrarNotificacion("Error al cargar usuarios: " + (errEx.message || errEx), "error");
    }
}

async function eliminarUsuario(nombreUsuario) {
    const rolActual = sessionStorage.getItem("rol");
    if (rolActual !== "admin") {
        mostrarNotificacion("Permiso denegado: Solo el Administrador puede eliminar usuarios.", "error");
        return;
    }

    if (nombreUsuario === sessionStorage.getItem("usuario")) {
        mostrarNotificacion("No puedes eliminar la cuenta con la que has iniciado sesión.", "error");
        return;
    }

    const confirmado = await mostrarConfirmacion(`¿Estás seguro de que deseas eliminar la cuenta de usuario "${nombreUsuario}"?`);
    if (confirmado) {
        console.log("Eliminando usuario de Supabase:", nombreUsuario);
        const { error } = await supabaseClient
            .from('usuarios')
            .delete()
            .eq('usuario', nombreUsuario);

        console.log("Resultado eliminar usuario:", error);

        if (error) {
            mostrarNotificacion("Error al eliminar usuario: " + error.message, "error");
        } else {
            mostrarNotificacion(`Usuario "${nombreUsuario}" eliminado correctamente.`, "success");
            cargarUsuarios();
        }
    }
}

/* ==========================================================================
   PASO 7: MÓDULO DE PROVEEDORES (TABLA: proveedores)
   Roles con permiso: admin, encargado_proveedores
   ========================================================================== */
async function cargarProveedores() {
    const tableBody = document.getElementById("proveedoresTableBody");
    if (!tableBody) return;

    console.log("Cargando proveedores desde Supabase...");
    const { data: listaProveedores, error } = await supabaseClient
        .from("proveedores")
        .select("*")
        .order("codigo", { ascending: false });

    console.log("Resultado carga proveedores:", listaProveedores, "Error:", error);

    if (error) {
        console.error("Error al cargar proveedores:", error);
        mostrarNotificacion("Error al cargar proveedores: " + error.message, "error");
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
        fila.className = "border-b border-slate-800/60 hover:bg-slate-800/30 transition";

        fila.innerHTML = `
            <td class="py-3 px-3 text-sky-400 font-bold">#${prov.codigo}</td>
            <td class="py-3 px-3 text-slate-200"></td>
            <td class="py-3 px-3 text-slate-300"></td>
            <td class="py-3 px-3 text-slate-300"></td>
            <td class="py-3 px-3 text-slate-400"></td>
            <td class="py-3 px-3 text-slate-400"></td>
            <td class="py-3 px-3 text-center">
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

function cancelarEdicionProveedor() {
    proveedorEnEdicionId = null;

    const proveedoresForm = document.getElementById("proveedoresForm");
    if (proveedoresForm) {
        proveedoresForm.reset();
    }

    const titulo = document.getElementById("tituloProveedor");
    if (titulo) {
        titulo.textContent = "Registrar proveedor";
    }

    const botonGuardar = document.getElementById("btnGuardarProveedor");
    if (botonGuardar) {
        botonGuardar.innerHTML = `
            <i data-lucide="check" class="w-4 h-4"></i>
            <span>Registrar proveedor</span>
        `;
        refrescarIconos();
    }

    const botonCancelar = document.getElementById("btnCancelarProveedor");
    if (botonCancelar) {
        botonCancelar.classList.add("hidden");
    }
}

/* ==========================================================================
   PASO 8: CATÁLOGO PÚBLICO PARA CLIENTES (index.html)
   ========================================================================== */
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

    console.log("Cargando catálogo público...");
    const { data: productos, error } = await supabaseClient
        .from('productos')
        .select('*')
        .order('id', { ascending: false });

    console.log("Resultado catálogo público:", productos, "Error:", error);

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

/* ==========================================================================
   PASO 9: INICIALIZACIÓN DE FORMULARIOS Y EVENT LISTENERS
   Garantiza que todos los elementos existan en el DOM antes de bindear eventos
   ========================================================================== */
function inicializarFormulariosYEventos() {
    // ----------------------------------------------------------------------
    // 1. FORMULARIO DE LOGIN (login.html)
    // ----------------------------------------------------------------------
    const loginForm = document.getElementById("loginForm");
    if (loginForm && !loginForm.dataset.listenerAdjunto) {
        loginForm.dataset.listenerAdjunto = "true";
        loginForm.addEventListener("submit", async (evento) => {
            evento.preventDefault();

            const usuarioInput = document.getElementById("usuario").value.trim();
            const passwordInput = document.getElementById("password").value.trim();
            const btnLogin = document.getElementById("btnLogin");

            if (!usuarioInput || !passwordInput) {
                mostrarNotificacion("Por favor ingresa usuario y contraseña.", "error");
                return;
            }

            if (btnLogin) {
                btnLogin.disabled = true;
                btnLogin.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> <span>Verificando...</span>`;
                refrescarIconos();
            }

            try {
                console.log("Intentando login para:", { usuario: usuarioInput });
                console.log("Consultando tabla usuarios en Supabase...");

                const { data: usuarioData, error: errorUsuario } = await supabaseClient
                    .from('usuarios')
                    .select('*')
                    .eq('usuario', usuarioInput)
                    .eq('password', passwordInput)
                    .maybeSingle();

                console.log("Resultado consulta usuarios:", usuarioData);
                console.log("Error consulta usuarios:", errorUsuario);

                if (errorUsuario) {
                    console.error("Error devuelto por Supabase al consultar usuarios:", errorUsuario);
                    mostrarNotificacion("Error al verificar credenciales: " + (errorUsuario.message || JSON.stringify(errorUsuario)), "error");
                    restaurarBotonLogin();
                    return;
                }

                if (!usuarioData) {
                    console.warn("No se encontró ningún registro en usuarios con esas credenciales.");

                    // Verificación de respaldo para arranque inicial: si la tabla usuarios está vacía
                    // y se ingresa admin / 1234, registrar al administrador inicial en Supabase
                    console.log("Verificando si la tabla usuarios está vacía en Supabase...");
                    const { count, error: countErr } = await supabaseClient
                        .from('usuarios')
                        .select('*', { count: 'exact', head: true });

                    console.log("Conteo de usuarios en Supabase:", count, "Error conteo:", countErr);

                    if (!countErr && count === 0 && usuarioInput === "admin" && passwordInput === "1234") {
                        console.log("Tabla usuarios vacía. Registrando usuario admin inicial...");
                        const { error: insErr } = await supabaseClient
                            .from('usuarios')
                            .insert([{
                                usuario: "admin",
                                password: "1234",
                                rol: "admin",
                                identidad: null
                            }]);

                        console.log("Resultado inserción admin inicial, error:", insErr);

                        if (!insErr) {
                            sessionStorage.setItem("usuario", "admin");
                            sessionStorage.setItem("rol", "admin");
                            sessionStorage.setItem("nombre", "Administrador Principal");
                            mostrarNotificacion("¡Administrador inicial registrado en Supabase! Entrando...", "success");
                            setTimeout(() => {
                                window.location.href = "inventario.html";
                            }, 800);
                            return;
                        }
                    }

                    mostrarNotificacion("Usuario o contraseña incorrectos.", "error");
                    restaurarBotonLogin();
                    return;
                }

                // Usuario encontrado con éxito
                let nombreMostrar = usuarioData.usuario;

                if (usuarioData.identidad) {
                    console.log("Consultando personal para identidad:", usuarioData.identidad);
                    const { data: personalData, error: personalError } = await supabaseClient
                        .from('personal')
                        .select('nombres_apellidos')
                        .eq('identidad', usuarioData.identidad)
                        .maybeSingle();

                    console.log("Resultado consulta personal:", personalData, "Error personal:", personalError);

                    if (personalData && personalData.nombres_apellidos) {
                        nombreMostrar = personalData.nombres_apellidos;
                    }
                }

                sessionStorage.setItem("usuario", usuarioData.usuario);
                sessionStorage.setItem("rol", usuarioData.rol);
                sessionStorage.setItem("nombre", nombreMostrar);
                if (usuarioData.identidad) {
                    sessionStorage.setItem("identidad", usuarioData.identidad);
                } else {
                    sessionStorage.removeItem("identidad");
                }

                const rolTexto = obtenerNombreRol(usuarioData.rol);
                mostrarNotificacion(`¡Bienvenido/a, ${nombreMostrar}! (${rolTexto})`, "success");

                setTimeout(() => {
                    window.location.href = "inventario.html";
                }, 800);

            } catch (err) {
                console.error("Excepción en submit de loginForm:", err);
                mostrarNotificacion("Error al iniciar sesión: " + (err.message || err), "error");
                restaurarBotonLogin();
            }
        });
    }

    // ----------------------------------------------------------------------
    // 2. FORMULARIO DE PRODUCTOS / PRENDAS (inventario.html)
    // ----------------------------------------------------------------------
    const productForm = document.getElementById("productForm");
    if (productForm && !productForm.dataset.listenerAdjunto) {
        productForm.dataset.listenerAdjunto = "true";
        productForm.addEventListener("submit", async (evento) => {
            evento.preventDefault();

            const rolActual = sessionStorage.getItem("rol");
            if (rolActual !== "admin" && rolActual !== "encargado_inventario") {
                mostrarNotificacion("Permiso denegado: Tu rol no permite registrar ni editar prendas.", "error");
                return;
            }

            const nombreIngresado = document.getElementById("nombre").value.trim();
            const cantidadIngresada = document.getElementById("cantidad").value;
            const precioIngresado = document.getElementById("precio").value;

            if (idProductoEditando === null) {
                console.log("Insertando producto nuevo:", { nombre: nombreIngresado, cantidad: cantidadIngresada, precio: precioIngresado });
                const { error } = await supabaseClient
                    .from('productos')
                    .insert([{
                        nombre: nombreIngresado,
                        cantidad: parseInt(cantidadIngresada),
                        precio: parseFloat(precioIngresado)
                    }]);

                console.log("Resultado insertar producto:", error);

                if (error) {
                    mostrarNotificacion("Error al guardar prenda: " + error.message, "error");
                } else {
                    mostrarNotificacion("¡Prenda agregada al catálogo en la nube!", "success");
                    productForm.reset();
                    cargarInventario(); 
                }
            } else {
                console.log("Actualizando producto id:", idProductoEditando);
                const { error } = await supabaseClient
                    .from('productos')
                    .update({
                        nombre: nombreIngresado,
                        cantidad: parseInt(cantidadIngresada),
                        precio: parseFloat(precioIngresado)
                    })
                    .eq('id', idProductoEditando);

                console.log("Resultado actualizar producto:", error);

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

    const btnCancelarEdicion = document.getElementById("btnCancelarEdicion");
    if (btnCancelarEdicion && !btnCancelarEdicion.dataset.listenerAdjunto) {
        btnCancelarEdicion.dataset.listenerAdjunto = "true";
        btnCancelarEdicion.addEventListener("click", cancelarEdicionProducto);
    }

    // ----------------------------------------------------------------------
    // 3. FORMULARIO DE PERSONAL (personal.html)
    // ----------------------------------------------------------------------
    const personalForm = document.getElementById("personalForm");
    if (personalForm && !personalForm.dataset.listenerAdjunto) {
        personalForm.dataset.listenerAdjunto = "true";
        personalForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const rolActual = sessionStorage.getItem("rol");
            if (rolActual !== "admin") {
                mostrarNotificacion("Permiso denegado: Solo el Administrador puede registrar colaboradores.", "error");
                return;
            }

            const nuevoColaborador = {
                identidad: document.getElementById("identidad").value.trim(),
                nombres_apellidos: document.getElementById("nombres_apellidos").value.trim(),
                genero: document.getElementById("genero").value,
                telefono: document.getElementById("telefono").value.trim(),
                direccion: document.getElementById("direccion").value.trim()
            };

            console.log("Insertando colaborador en Supabase:", nuevoColaborador);
            const { error } = await supabaseClient.from('personal').insert([nuevoColaborador]);
            console.log("Resultado insertar personal:", error);

            if (error) {
                mostrarNotificacion("Error al registrar colaborador: " + error.message, "error");
            } else {
                mostrarNotificacion("¡Colaborador registrado en el Equipo de la Boutique!", "success");
                personalForm.reset();
                cargarPersonal();
                cargarSelectEmpleados();
            }
        });
    }

    // ----------------------------------------------------------------------
    // 4. FORMULARIO DE CREAR USUARIOS (personal.html)
    // ----------------------------------------------------------------------
    const usuarioForm = document.getElementById("usuarioForm");
    if (usuarioForm && !usuarioForm.dataset.listenerAdjunto) {
        usuarioForm.dataset.listenerAdjunto = "true";
        usuarioForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const rolActual = sessionStorage.getItem("rol");
            if (rolActual !== "admin") {
                mostrarNotificacion("Permiso denegado: Solo el Administrador puede registrar cuentas de usuario.", "error");
                return;
            }

            const usuarioVal = document.getElementById("nuevoUsuario").value.trim();
            const passwordVal = document.getElementById("nuevoPassword").value.trim();
            const rolVal = document.getElementById("nuevoRol").value;
            const identidadSelect = document.getElementById("nuevoEmpleadoIdentidad");
            const identidadVal = (identidadSelect && identidadSelect.value.trim()) ? identidadSelect.value.trim() : null;

            if (!usuarioVal || !passwordVal || !rolVal) {
                mostrarNotificacion("Por favor completa los campos obligatorios del usuario.", "error");
                return;
            }

            const nuevoUsuarioObj = {
                usuario: usuarioVal,
                password: passwordVal,
                rol: rolVal,
                identidad: identidadVal
            };

            console.log("Insertando nuevo usuario en Supabase:", nuevoUsuarioObj);

            try {
                const { data, error } = await supabaseClient
                    .from('usuarios')
                    .insert([nuevoUsuarioObj])
                    .select();

                console.log("Resultado inserción usuario:", data, "Error:", error);

                if (error) {
                    console.error("Error al crear usuario:", error);
                    mostrarNotificacion("Error al crear usuario: " + (error.message || JSON.stringify(error)), "error");
                    return;
                }

                mostrarNotificacion(`¡Cuenta de usuario "${usuarioVal}" creada exitosamente!`, "success");
                usuarioForm.reset();
                await cargarUsuarios();
            } catch (err) {
                console.error("Excepción al crear usuario:", err);
                mostrarNotificacion("Error al crear usuario: " + (err.message || err), "error");
            }
        });
    }

    // ----------------------------------------------------------------------
    // 5. FORMULARIO Y TABLA DE PROVEEDORES (proveedores.html)
    // ----------------------------------------------------------------------
    const proveedoresForm = document.getElementById("proveedoresForm");
    if (proveedoresForm && !proveedoresForm.dataset.listenerAdjunto) {
        proveedoresForm.dataset.listenerAdjunto = "true";
        proveedoresForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const rolActual = sessionStorage.getItem("rol");
            if (rolActual !== "admin" && rolActual !== "encargado_proveedores") {
                mostrarNotificacion("Permiso denegado: Tu rol no permite gestionar proveedores.", "error");
                return;
            }

            const proveedor = {
                empresa: document.getElementById("empresa").value.trim(),
                encargado: document.getElementById("encargado").value.trim(),
                telefono: document.getElementById("telefono_prov").value.trim(),
                direccion: document.getElementById("direccion_prov").value.trim(),
                correo: document.getElementById("correo").value.trim()
            };

            let resultado;
            if (proveedorEnEdicionId !== null) {
                console.log("Actualizando proveedor:", proveedorEnEdicionId, proveedor);
                resultado = await supabaseClient
                    .from("proveedores")
                    .update(proveedor)
                    .eq("codigo", proveedorEnEdicionId);
            } else {
                console.log("Insertando proveedor:", proveedor);
                resultado = await supabaseClient
                    .from("proveedores")
                    .insert([proveedor]);
            }

            console.log("Resultado guardar proveedor:", resultado);

            if (resultado.error) {
                mostrarNotificacion("Error al guardar proveedor: " + resultado.error.message, "error");
                return;
            }

            if (proveedorEnEdicionId !== null) {
                mostrarNotificacion("Proveedor actualizado correctamente.", "success");
            } else {
                mostrarNotificacion("Proveedor registrado correctamente.", "success");
            }

            cancelarEdicionProveedor();
            await cargarProveedores();
        });
    }

    const proveedoresTableBody = document.getElementById("proveedoresTableBody");
    if (proveedoresTableBody && !proveedoresTableBody.dataset.listenerAdjunto) {
        proveedoresTableBody.dataset.listenerAdjunto = "true";
        proveedoresTableBody.addEventListener("click", async (e) => {
            const boton = e.target.closest("button[data-accion]");
            if (!boton) return;

            const rolActual = sessionStorage.getItem("rol");
            if (rolActual !== "admin" && rolActual !== "encargado_proveedores") {
                mostrarNotificacion("Permiso denegado: No tienes permisos para modificar proveedores.", "error");
                return;
            }

            const codigo = boton.dataset.id;
            const accion = boton.dataset.accion;

            if (accion === "editar") {
                console.log("Buscando proveedor para editar, codigo:", codigo);
                const { data, error } = await supabaseClient
                    .from("proveedores")
                    .select("*")
                    .eq("codigo", codigo)
                    .single();

                console.log("Resultado buscar proveedor:", data, "Error:", error);

                if (error) {
                    mostrarNotificacion("Error al buscar proveedor: " + error.message, "error");
                    return;
                }

                proveedorEnEdicionId = codigo;
                document.getElementById("empresa").value = data.empresa || "";
                document.getElementById("encargado").value = data.encargado || "";
                document.getElementById("telefono_prov").value = data.telefono || "";
                document.getElementById("direccion_prov").value = data.direccion || "";
                document.getElementById("correo").value = data.correo || "";

                const titulo = document.getElementById("tituloProveedor");
                if (titulo) titulo.textContent = "Editar proveedor";

                const botonGuardar = document.getElementById("btnGuardarProveedor");
                if (botonGuardar) {
                    botonGuardar.innerHTML = `
                        <i data-lucide="save" class="w-4 h-4"></i>
                        <span>Actualizar proveedor</span>
                    `;
                    refrescarIconos();
                }

                const botonCancelar = document.getElementById("btnCancelarProveedor");
                if (botonCancelar) botonCancelar.classList.remove("hidden");
            }

            if (accion === "eliminar") {
                const confirmar = await mostrarConfirmacion("¿Estás seguro de eliminar este proveedor?");
                if (!confirmar) return;

                console.log("Eliminando proveedor codigo:", codigo);
                const { error } = await supabaseClient
                    .from("proveedores")
                    .delete()
                    .eq("codigo", codigo);

                console.log("Resultado eliminar proveedor:", error);

                if (error) {
                    mostrarNotificacion("Error al eliminar proveedor: " + error.message, "error");
                    return;
                }

                mostrarNotificacion("Proveedor eliminado correctamente.", "success");
                await cargarProveedores();
            }
        });
    }

    const btnCancelarProveedor = document.getElementById("btnCancelarProveedor");
    if (btnCancelarProveedor && !btnCancelarProveedor.dataset.listenerAdjunto) {
        btnCancelarProveedor.dataset.listenerAdjunto = "true";
        btnCancelarProveedor.addEventListener("click", cancelarEdicionProveedor);
    }

    // ----------------------------------------------------------------------
    // 6. BUSCADOR EN CATÁLOGO PÚBLICO (index.html)
    // ----------------------------------------------------------------------
    const inputBusquedaCatalogo = document.getElementById("inputBusquedaCatalogo");
    if (inputBusquedaCatalogo && !inputBusquedaCatalogo.dataset.listenerAdjunto) {
        inputBusquedaCatalogo.dataset.listenerAdjunto = "true";
        inputBusquedaCatalogo.addEventListener("input", (e) => {
            filtrarCatalogoPublico(e.target.value);
        });
    }
}

/* ==========================================================================
   PASO 10: INICIALIZACIÓN GENERAL DEL SISTEMA AL CARGAR LA PÁGINA
   ========================================================================== */
function inicializarSistema() {
    refrescarIconos();
    inicializarFormulariosYEventos();
    configurarSidebarYHeader();
    aplicarPermisosInventario();

    if (document.getElementById("catalogoPublicoGrid")) cargarCatalogoPublico();
    if (document.getElementById("productTableBody")) cargarInventario();
    if (document.getElementById("personalTableBody")) cargarPersonal();
    if (document.getElementById("usuariosTableBody")) {
        cargarUsuarios();
        cargarSelectEmpleados();
    }
    if (document.getElementById("proveedoresTableBody")) cargarProveedores();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inicializarSistema);
} else {
    inicializarSistema();
}
