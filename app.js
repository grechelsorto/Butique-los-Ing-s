/* ==========================================================================
   BOUTIQUE LOS ING'S - SISTEMA WEB INTEGRAL
   Supabase, autenticación, inventario, fotografías IA,
   personal, usuarios, proveedores y catálogo público.
   ========================================================================== */

/* ==========================================================================
   PASO 1: CONEXIÓN A SUPABASE
   ========================================================================== */

const SUPABASE_URL = "https://nlcegrldtsnafytvvaqi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_isjSuro7NLTxsilu6-VL2Q_aHn6GqvY";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

let idProductoEditando = null;
let proveedorEnEdicionId = null;
let catalogoPrendasPublico = [];
let productosInventarioActuales = [];
let imagenProductoGenerada = null;

/* ==========================================================================
   PASO 2: UTILIDADES GENERALES
   ========================================================================== */

function refrescarIconos() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
        window.lucide.createIcons({
            attrs: { "stroke-width": 1.75 }
        });
    }
}

function formatearLempiras(monto) {
    const numero = Number(monto) || 0;

    return `L ${numero.toLocaleString("es-HN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function escaparAtributo(valor) {
    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function mostrarNotificacion(mensaje, tipo = "success") {
    const notificacion = document.createElement("div");

    const colorFondo = tipo === "success"
        ? "bg-slate-900/95 border-pink-400/50 text-pink-200 shadow-pink-500/20"
        : "bg-slate-900/95 border-rose-500/50 text-rose-200 shadow-rose-500/20";

    const icono = tipo === "success"
        ? "check-circle-2"
        : "alert-triangle";

    const iconoColor = tipo === "success"
        ? "text-emerald-400"
        : "text-rose-400";

    notificacion.className =
        `fixed bottom-5 right-5 z-50 px-4 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-md text-sm font-medium transition-all duration-300 flex items-center gap-2.5 ${colorFondo}`;

    notificacion.innerHTML = `
        <i data-lucide="${icono}" class="w-5 h-5 shrink-0 ${iconoColor}"></i>
        <span class="leading-snug">${escaparAtributo(mensaje)}</span>
    `;

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

        overlay.className =
            "fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4";

        const esEliminar = textoConfirmar
            ? textoConfirmar.toLowerCase().includes("eliminar")
            : (
                mensaje.toLowerCase().includes("eliminar") ||
                mensaje.toLowerCase().includes("retirar")
            );

        const btnTexto = textoConfirmar ||
            (esEliminar ? "Eliminar" : "Confirmar");

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

                <h3 class="text-lg font-bold text-pink-400 neon-title">
                    Confirmar acción
                </h3>

                <p class="text-sm text-slate-300 leading-relaxed">
                    ${escaparAtributo(mensaje)}
                </p>

                <div class="flex gap-3 justify-center pt-2">

                    <button id="btnModalCancelar" type="button"
                        class="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 text-sm font-medium transition flex items-center justify-center gap-1.5">

                        <i data-lucide="x" class="w-4 h-4"></i>
                        <span>Cancelar</span>
                    </button>

                    <button id="btnModalConfirmar" type="button"
                        class="flex-1 py-2.5 px-4 rounded-xl border ${btnClase} text-sm font-semibold transition flex items-center justify-center gap-1.5 shadow-lg">

                        <i data-lucide="${btnIcono}" class="w-4 h-4"></i>
                        <span>${escaparAtributo(btnTexto)}</span>
                    </button>

                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        refrescarIconos();

        overlay.querySelector("#btnModalCancelar")
            .addEventListener("click", () => {
                overlay.remove();
                resolve(false);
            });

        overlay.querySelector("#btnModalConfirmar")
            .addEventListener("click", () => {
                overlay.remove();
                resolve(true);
            });
    });
}

/* ==========================================================================
   PASO 3: GENERACIÓN DE FOTOGRAFÍAS CON INTELIGENCIA ARTIFICIAL
   Supabase Edge Function: generar-fotos
   Bucket: fotos-productos
   ========================================================================== */

function obtenerUrlImagen(imagenes) {
    if (!imagenes) return null;

    if (Array.isArray(imagenes)) {
        for (const imagen of imagenes) {
            if (typeof imagen === "string" && imagen.startsWith("http")) {
                return imagen;
            }

            if (imagen && typeof imagen === "object") {
                const url = imagen.url || imagen.imagen_url;

                if (typeof url === "string" && url.startsWith("http")) {
                    return url;
                }
            }
        }

        return null;
    }

    if (typeof imagenes === "string") {
        try {
            const resultado = JSON.parse(imagenes);

            if (resultado !== imagenes) {
                return obtenerUrlImagen(resultado);
            }
        } catch {
            return imagenes.startsWith("http")
                ? imagenes
                : null;
        }

        return null;
    }

    if (typeof imagenes === "object") {
        const url = imagenes.url || imagenes.imagen_url;

        return typeof url === "string" && url.startsWith("http")
            ? url
            : null;
    }

    return null;
}

function limpiarImagenProducto() {
    imagenProductoGenerada = null;

    const contenedor = document.getElementById("contenedorVistaPrevia");
    const vistaPrevia = document.getElementById("vistaPreviaProducto");
    const descripcion = document.getElementById("descripcionImagen");
    const estado = document.getElementById("estadoGeneracionImagen");

    if (contenedor) contenedor.classList.add("hidden");
    if (vistaPrevia) vistaPrevia.src = "";
    if (descripcion) descripcion.value = "";
    if (estado) estado.textContent = "";
}

async function generarFotografiaProducto() {
    const nombre = document.getElementById("nombre")?.value.trim();
    const descripcion =
        document.getElementById("descripcionImagen")?.value.trim() || "";

    const boton = document.getElementById("btnGenerarFotografia");
    const estado = document.getElementById("estadoGeneracionImagen");
    const contenedor = document.getElementById("contenedorVistaPrevia");
    const vistaPrevia = document.getElementById("vistaPreviaProducto");

    const rolActual = sessionStorage.getItem("rol");

    if (rolActual !== "admin" && rolActual !== "encargado_inventario") {
        mostrarNotificacion(
            "No tienes permiso para generar fotografías.",
            "error"
        );
        return;
    }

    if (!nombre) {
        mostrarNotificacion(
            "Primero escribe el nombre de la prenda.",
            "error"
        );

        document.getElementById("nombre")?.focus();
        return;
    }

    if (!boton || !estado || !contenedor || !vistaPrevia) {
        mostrarNotificacion(
            "No se encontraron los elementos de fotografía en inventario.html.",
            "error"
        );
        return;
    }

    boton.disabled = true;

    boton.innerHTML = `
        <i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>
        <span>Generando fotografía...</span>
    `;

    estado.textContent = "Generando fotografía. Espera un momento...";
    refrescarIconos();

    try {
        const { data, error } = await supabaseClient.functions.invoke(
            "generar-fotos",
            {
                body: {
                    nombreProducto: nombre,
                    descripcion: descripcion
                }
            }
        );

        if (error) {
            console.error("Error al llamar generar-fotos:", error);

            throw new Error(
                error.message || "No se pudo comunicar con el servicio."
            );
        }

        if (!data || !data.imagen_url) {
            throw new Error(
                data?.error || "No se recibió la fotografía."
            );
        }

        imagenProductoGenerada = data.imagen_url;

        vistaPrevia.src = imagenProductoGenerada;
        contenedor.classList.remove("hidden");

        estado.textContent =
            "Fotografía generada correctamente. Se guardará al guardar la prenda.";

        mostrarNotificacion(
            "Fotografía generada correctamente.",
            "success"
        );

    } catch (error) {
        console.error("Error al generar fotografía:", error);

        estado.textContent =
            error.message || "Error al generar fotografía.";

        mostrarNotificacion(
            error.message || "No se pudo generar la fotografía.",
            "error"
        );

    } finally {
        boton.disabled = false;

        boton.innerHTML = `
            <i data-lucide="image-plus" class="w-4 h-4"></i>
            <span>Generar fotografía con IA</span>
        `;

        refrescarIconos();
    }
}

/* ==========================================================================
   PASO 4: CONTROL DE ACCESO Y SESIÓN
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
    const rol = (sessionStorage.getItem("rol") || "").trim().toLowerCase();

    if (!usuario || !rol) {
        window.location.replace("login.html");
        return false;
    }

    const rolesNorm = (rolesPermitidos || []).map(r => String(r).trim().toLowerCase());

    if (
        rolesNorm.length > 0 &&
        !rolesNorm.includes(rol)
    ) {
        let destino = "inventario.html";

        if (rol === "encargado_proveedores") {
            destino = "proveedores.html";
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

    const elHeaderNombre =
        document.getElementById("headerUsuarioNombre");

    const elHeaderRol =
        document.getElementById("headerUsuarioRol");

    if (elHeaderNombre && usuario) {
        elHeaderNombre.textContent = nombre;
    }

    if (elHeaderRol && rol) {
        elHeaderRol.textContent = obtenerNombreRol(rol);
    }

    if (rol) {
        const linkPersonal =
            document.getElementById("linkNavPersonal");

        const linkPersonalMobile =
            document.getElementById("linkNavPersonalMobile");

        const linkProveedores =
            document.getElementById("linkNavProveedores");

        const linkProveedoresMobile =
            document.getElementById("linkNavProveedoresMobile");

        if (rol !== "admin") {
            linkPersonal?.classList.add("hidden");
            linkPersonalMobile?.classList.add("hidden");
        }

        if (
            rol !== "admin" &&
            rol !== "encargado_proveedores"
        ) {
            linkProveedores?.classList.add("hidden");
            linkProveedoresMobile?.classList.add("hidden");
        }
    }
}

function aplicarPermisosInventario() {
    const rol = sessionStorage.getItem("rol");
    if (!rol) return;

    const esSoloLectura =
        rol === "encargado_proveedores" ||
        rol === "asesor";

    const colFormulario =
        document.getElementById("columnaFormularioInventario");

    const colTabla =
        document.getElementById("columnaTablaInventario");

    const bannerLectura =
        document.getElementById("bannerSoloLecturaInventario");

    const btnEjemplos =
        document.getElementById("btnCargarEjemplos");

    const thAcciones =
        document.getElementById("thAccionesInventario");

    if (esSoloLectura) {
        colFormulario?.classList.add("hidden");

        if (colTabla) {
            colTabla.classList.remove("lg:col-span-2");
            colTabla.classList.add("lg:col-span-3", "w-full");
        }

        bannerLectura?.classList.remove("hidden");
        btnEjemplos?.classList.add("hidden");

        if (thAcciones) {
            thAcciones.innerHTML = "<span>Permiso</span>";
        }
    }
}

function restaurarBotonLogin() {
    const btnLogin = document.getElementById("btnLogin");

    if (btnLogin) {
        btnLogin.disabled = false;

        btnLogin.innerHTML = `
            <i data-lucide="log-in" class="w-4 h-4"></i>
            <span>Entrar al Panel de la Boutique</span>
        `;

        refrescarIconos();
    }
}

async function iniciarSesion(evento) {
    evento.preventDefault();

    const usuarioInput = document.getElementById("usuario")?.value.trim();
    const passwordInput = document.getElementById("password")?.value.trim();
    const btnLogin = document.getElementById("btnLogin");

    if (!usuarioInput || !passwordInput) {
        mostrarNotificacion("Ingresa tu usuario y contraseña.", "error");
        return;
    }

    if (btnLogin) {
        btnLogin.disabled = true;
        btnLogin.innerHTML = `
            <i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>
            <span>Verificando credenciales...</span>
        `;
        refrescarIconos();
    }

    try {
        const { data: usuarioData, error } = await supabaseClient
            .from("usuarios")
            .select("*")
            .eq("usuario", usuarioInput)
            .eq("password", passwordInput)
            .maybeSingle();

        if (error) {
            throw new Error(error.message);
        }

        if (!usuarioData) {
            mostrarNotificacion("Usuario o contraseña incorrectos.", "error");
            restaurarBotonLogin();
            return;
        }

        if (usuarioData.activo === false) {
            mostrarNotificacion("Este usuario está desactivado. Contacta al administrador.", "error");
            restaurarBotonLogin();
            return;
        }

        sessionStorage.setItem("usuarioId", usuarioData.id);
        sessionStorage.setItem("usuario", usuarioData.usuario);
        sessionStorage.setItem("nombre", usuarioData.nombre || usuarioData.usuario);
        sessionStorage.setItem("rol", usuarioData.rol);

        mostrarNotificacion(`¡Bienvenido/a, ${usuarioData.nombre || usuarioData.usuario}!`, "success");

        setTimeout(() => {
            if (usuarioData.rol === "encargado_proveedores") {
                window.location.replace("proveedores.html");
            } else {
                window.location.replace("inventario.html");
            }
        }, 600);

    } catch (error) {
        console.error("Error en login:", error);
        mostrarNotificacion("Error al iniciar sesión: " + error.message, "error");
        restaurarBotonLogin();
    }
}

/* ==========================================================================
   PASO 5: MÓDULO DE INVENTARIO
   Tabla: productos
   Columnas: id, nombre, cantidad, precio, creado_en, imagenes
   imagenes: JSONB
   ========================================================================== */

function actualizarResumenInventario(productos = []) {
    const elTotal =
        document.getElementById("statTotalProductos");

    const elStock =
        document.getElementById("statUnidadesStock");

    const elValor =
        document.getElementById("statValorInventario");

    const totalProductos = productos.length;

    const totalUnidades = productos.reduce(
        (acc, item) => acc + (Number(item.cantidad) || 0),
        0
    );

    const valorTotal = productos.reduce(
        (acc, item) =>
            acc +
            (
                (Number(item.cantidad) || 0) *
                (Number(item.precio) || 0)
            ),
        0
    );

    if (elTotal) elTotal.textContent = totalProductos;
    if (elStock) elStock.textContent = totalUnidades;
    if (elValor) elValor.textContent = formatearLempiras(valorTotal);
}

async function cargarInventario() {
    const tableBody =
        document.getElementById("productTableBody");

    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="4" class="py-10 text-center text-slate-400">
                <i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>
                Cargando catálogo de prendas...
            </td>
        </tr>
    `;

    refrescarIconos();

    const { data: productos, error } = await supabaseClient
        .from("productos")
        .select("*")
        .order("id", { ascending: false });

    if (error) {
        console.error("Error al cargar inventario:", error);

        mostrarNotificacion(
            "Error al cargar el catálogo: " + error.message,
            "error"
        );

        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="py-8 text-center text-rose-400">
                    Error al cargar el catálogo de prendas.
                </td>
            </tr>
        `;

        actualizarResumenInventario([]);
        return;
    }

    productosInventarioActuales = productos || [];

    actualizarResumenInventario(productosInventarioActuales);

    if (productosInventarioActuales.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="py-10 text-center text-slate-400">
                    <i data-lucide="package-open" class="w-6 h-6 mx-auto mb-2"></i>
                    <p class="font-medium">No hay prendas registradas aún</p>
                    <p class="text-xs">Usa el formulario para agregar la primera prenda.</p>
                </td>
            </tr>
        `;

        refrescarIconos();
        return;
    }

    const rolActual = sessionStorage.getItem("rol");

    const esSoloLectura =
        rolActual === "encargado_proveedores" ||
        rolActual === "asesor";

    tableBody.innerHTML = "";

    productosInventarioActuales.forEach(producto => {
        const fila = document.createElement("tr");

        fila.className =
            "border-b border-slate-800/60 hover:bg-pink-500/5 transition-colors duration-150";

        const urlImagen = obtenerUrlImagen(producto.imagenes);

        const imagenHtml = urlImagen
            ? `
                <img
                    src="${escaparAtributo(urlImagen)}"
                    alt="${escaparAtributo(producto.nombre)}"
                    class="w-12 h-12 object-cover rounded-lg border border-pink-500/30"
                    loading="lazy"
                >
            `
            : `
                <div class="w-12 h-12 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
                    <i data-lucide="shirt" class="w-5 h-5 text-pink-400"></i>
                </div>
            `;

        let celdaAcciones = "";

        if (esSoloLectura) {
            celdaAcciones = `
                <span class="inline-flex items-center gap-1 text-xs text-slate-400">
                    <i data-lucide="eye" class="w-4 h-4"></i>
                    Solo Lectura
                </span>
            `;
        } else {
            celdaAcciones = `
                <div class="inline-flex items-center justify-center gap-2">

                    <button
                        type="button"
                        data-id="${escaparAtributo(producto.id)}"
                        class="btnEditarProducto inline-flex items-center gap-1.5 text-xs font-medium bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/35 px-2.5 py-1.5 rounded-lg">

                        <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                        Editar
                    </button>

                    <button
                        type="button"
                        data-id="${escaparAtributo(producto.id)}"
                        class="btnEliminarProducto inline-flex items-center gap-1.5 text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2.5 py-1.5 rounded-lg">

                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        Eliminar
                    </button>

                </div>
            `;
        }

        fila.innerHTML = `
            <td class="py-3.5 px-4 font-medium text-slate-100">
                <div class="flex items-center gap-3">
                    ${imagenHtml}
                    <span>${escaparAtributo(producto.nombre)}</span>
                </div>
            </td>

            <td class="py-3.5 px-4 font-medium text-slate-300">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                    ${Number(producto.cantidad) || 0} en stock
                </span>
            </td>

            <td class="py-3.5 px-4 font-semibold text-pink-400 whitespace-nowrap">
                ${formatearLempiras(producto.precio)}
            </td>

            <td class="py-3.5 px-4 text-center">
                ${celdaAcciones}
            </td>
        `;

        const btnEditar = fila.querySelector(".btnEditarProducto");

        if (btnEditar) {
            btnEditar.addEventListener("click", () => {
                prepararEdicion(producto.id);
            });
        }

        const btnEliminar = fila.querySelector(".btnEliminarProducto");

        if (btnEliminar) {
            btnEliminar.addEventListener("click", () => {
                eliminarProducto(producto.id);
            });
        }

        tableBody.appendChild(fila);
    });

    refrescarIconos();
}

function prepararEdicion(id) {
    const rolActual = sessionStorage.getItem("rol");

    if (
        rolActual !== "admin" &&
        rolActual !== "encargado_inventario"
    ) {
        mostrarNotificacion(
            "No tienes permisos para editar prendas.",
            "error"
        );
        return;
    }

    const producto = productosInventarioActuales.find(
        item => Number(item.id) === Number(id)
    );

    if (!producto) {
        mostrarNotificacion("No se encontró el producto.", "error");
        return;
    }

    idProductoEditando = producto.id;

    document.getElementById("nombre").value =
        producto.nombre || "";

    document.getElementById("cantidad").value =
        producto.cantidad ?? 0;

    document.getElementById("precio").value =
        producto.precio ?? 0;

    limpiarImagenProducto();

    const imagenExistente = obtenerUrlImagen(producto.imagenes);

    if (imagenExistente) {
        const contenedor =
            document.getElementById("contenedorVistaPrevia");

        const vistaPrevia =
            document.getElementById("vistaPreviaProducto");

        if (contenedor && vistaPrevia) {
            vistaPrevia.src = imagenExistente;
            contenedor.classList.remove("hidden");
        }
    }

    const botonSubmit =
        document.querySelector("#productForm button[type='submit']");

    if (botonSubmit) {
        botonSubmit.innerHTML = `
            <i data-lucide="save" class="w-4 h-4"></i>
            <span>Actualizar Prenda</span>
        `;
    }

    const tituloForm =
        document.getElementById("formProductoTitulo");

    if (tituloForm) {
        tituloForm.textContent = "Editar Prenda";
    }

    document.getElementById("btnCancelarEdicion")
        ?.classList.remove("hidden");

    refrescarIconos();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function cancelarEdicionProducto() {
    const formulario = document.getElementById("productForm");

    if (formulario) formulario.reset();

    idProductoEditando = null;
    limpiarImagenProducto();

    const botonSubmit =
        document.querySelector("#productForm button[type='submit']");

    if (botonSubmit) {
        botonSubmit.innerHTML = `
            <i data-lucide="check" class="w-4 h-4"></i>
            <span>Guardar Prenda</span>
        `;
    }

    const tituloForm =
        document.getElementById("formProductoTitulo");

    if (tituloForm) {
        tituloForm.textContent = "Nueva Prenda";
    }

    document.getElementById("btnCancelarEdicion")
        ?.classList.add("hidden");

    refrescarIconos();
}

async function guardarProducto(evento) {
    evento.preventDefault();

    const rolActual = sessionStorage.getItem("rol");

    if (
        rolActual !== "admin" &&
        rolActual !== "encargado_inventario"
    ) {
        mostrarNotificacion(
            "No tienes permiso para guardar prendas.",
            "error"
        );
        return;
    }

    const nombre = document.getElementById("nombre")?.value.trim();
    const cantidad = parseInt(document.getElementById("cantidad")?.value, 10) || 0;
    const precio = parseFloat(document.getElementById("precio")?.value) || 0;

    if (!nombre || cantidad < 0 || precio <= 0) {
        mostrarNotificacion(
            "Completa todos los campos con valores válidos.",
            "error"
        );
        return;
    }

    const datosProducto = {
        nombre,
        cantidad,
        precio
    };

    if (imagenProductoGenerada) {
        datosProducto.imagenes = [imagenProductoGenerada];
    }

    let errorOperacion = null;

    if (idProductoEditando) {
        const { error } = await supabaseClient
            .from("productos")
            .update(datosProducto)
            .eq("id", idProductoEditando);

        errorOperacion = error;
    } else {
        const { error } = await supabaseClient
            .from("productos")
            .insert([datosProducto]);

        errorOperacion = error;
    }

    if (errorOperacion) {
        mostrarNotificacion(
            "Error al guardar la prenda: " + errorOperacion.message,
            "error"
        );
        return;
    }

    mostrarNotificacion(
        idProductoEditando
            ? "¡Prenda actualizada correctamente!"
            : "¡Prenda registrada en el inventario!",
        "success"
    );

    cancelarEdicionProducto();
    await cargarInventario();
}

async function eliminarProducto(id) {
    const rolActual = sessionStorage.getItem("rol");

    if (
        rolActual !== "admin" &&
        rolActual !== "encargado_inventario"
    ) {
        mostrarNotificacion(
            "No tienes permiso para eliminar prendas.",
            "error"
        );
        return;
    }

    const confirmado = await mostrarConfirmacion(
        "¿Estás seguro de que deseas retirar esta prenda del catálogo?"
    );

    if (!confirmado) return;

    const { error } = await supabaseClient
        .from("productos")
        .delete()
        .eq("id", id);

    if (error) {
        mostrarNotificacion(
            "Error al eliminar prenda: " + error.message,
            "error"
        );
        return;
    }

    if (Number(idProductoEditando) === Number(id)) {
        cancelarEdicionProducto();
    }

    mostrarNotificacion(
        "¡Prenda eliminada del catálogo!",
        "success"
    );

    await cargarInventario();
}

async function cargarProductosEjemplo() {
    const rolActual = sessionStorage.getItem("rol");

    if (
        rolActual !== "admin" &&
        rolActual !== "encargado_inventario"
    ) {
        mostrarNotificacion(
            "Solo el Administrador o Encargado de Inventario pueden cargar ejemplos.",
            "error"
        );
        return;
    }

    const confirmado = await mostrarConfirmacion(
        "¿Cargar 15 productos de ejemplo de la boutique?"
    );

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
        { nombre: "Bufanda de cachemira estampada - Única", cantidad: 16, precio: 340.00 }
    ];

    const { error } = await supabaseClient
        .from("productos")
        .insert(productosEjemplo);

    if (error) {
        mostrarNotificacion(
            "Error al cargar productos de ejemplo: " + error.message,
            "error"
        );
        return;
    }

    mostrarNotificacion(
        "¡15 productos de ejemplo cargados correctamente!",
        "success"
    );

    await cargarInventario();
}

/* ==========================================================================
   PASO 6: MÓDULO DE PERSONAL Y USUARIOS
   Tabla personal: identidad (PK), nombres_apellidos, genero, telefono, direccion
   Tabla usuarios: usuario (PK), password, rol, identidad (FK)
   Roles: admin, encargado_inventario, encargado_proveedores, asesor
   ========================================================================== */

function actualizarResumenPersonal(listaPersonal = []) {
    const elTotal = document.getElementById("statTotalPersonal");
    const elMasc = document.getElementById("statPersonalMasculino");
    const elFem = document.getElementById("statPersonalFemenino");

    const data = Array.isArray(listaPersonal) ? listaPersonal : [];
    const total = data.length;

    const masculino = data.filter(p => {
        const g = String(p?.genero || "").toLowerCase().trim();
        return g === "masculino" || g === "m" || g.startsWith("masc");
    }).length;

    const femenino = data.filter(p => {
        const g = String(p?.genero || "").toLowerCase().trim();
        return g === "femenino" || g === "f" || g.startsWith("fem");
    }).length;

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

    try {
        const { data: listaPersonal, error } = await supabaseClient
            .from("personal")
            .select("identidad, nombres_apellidos, genero, telefono, direccion");

        console.log("Resultado carga personal:", listaPersonal);
        console.log("Error carga personal:", error);

        if (error) {
            console.error("Error al cargar personal:", error);
            mostrarNotificacion("Error al cargar el equipo: " + (error.message || JSON.stringify(error)), "error");
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-8 text-center text-rose-400">
                        <div class="inline-flex flex-col items-center gap-2 max-w-md mx-auto p-4 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 shadow-xl">
                            <div class="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                                <i data-lucide="alert-triangle" class="w-5 h-5 shrink-0"></i>
                                <span>Error al consultar la tabla personal en Supabase</span>
                            </div>
                            <p class="text-xs text-rose-200 font-mono break-all">${escaparAtributo(error.message || JSON.stringify(error))}</p>
                            ${error.hint ? `<p class="text-[11px] text-slate-400">Pista: ${escaparAtributo(error.hint)}</p>` : ""}
                            ${error.details ? `<p class="text-[11px] text-slate-400">Detalles: ${escaparAtributo(error.details)}</p>` : ""}
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
                <td class="py-3.5 px-4 text-pink-300 font-semibold whitespace-nowrap">${escaparAtributo(persona.identidad || "")}</td>
                <td class="py-3.5 px-4 text-slate-100 font-medium">${escaparAtributo(persona.nombres_apellidos || "")}</td>
                <td class="py-3.5 px-4 text-slate-300">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-500/15 text-violet-200 border border-violet-500/30">
                        ${escaparAtributo(persona.genero || "No especificado")}
                    </span>
                </td>
                <td class="py-3.5 px-4 text-slate-300 whitespace-nowrap">${escaparAtributo(persona.telefono || "-")}</td>
                <td class="py-3.5 px-4 text-slate-400">${escaparAtributo(persona.direccion || "-")}</td>
                <td class="py-3.5 px-4 text-center">
                    <button type="button"
                            data-identidad="${escaparAtributo(persona.identidad || "")}"
                            class="btnEliminarPersonal inline-flex items-center gap-1.5 text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 hover:border-rose-400/50 transition">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        <span>Eliminar</span>
                    </button>
                </td>
            `;
            const btnEliminar = fila.querySelector(".btnEliminarPersonal");
            if (btnEliminar) {
                btnEliminar.addEventListener("click", () => eliminarPersonal(persona.identidad));
            }
            tableBody.appendChild(fila);
        });

        refrescarIconos();

    } catch (errEx) {
        console.error("Excepción inesperada en cargarPersonal:", errEx);
        mostrarNotificacion("Error inesperado al cargar el personal: " + (errEx.message || errEx), "error");
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="py-8 text-center text-rose-400">
                    <div class="inline-flex flex-col items-center gap-2 max-w-md mx-auto p-4 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 shadow-xl">
                        <div class="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                            <i data-lucide="alert-triangle" class="w-5 h-5 shrink-0"></i>
                            <span>Error de ejecución al cargar personal</span>
                        </div>
                        <p class="text-xs text-rose-200 font-mono break-all">${escaparAtributo(errEx.message || String(errEx))}</p>
                    </div>
                </td>
            </tr>
        `;
        refrescarIconos();
        actualizarResumenPersonal([]);
    }
}

async function guardarPersonal(evento) {
    if (evento && evento.preventDefault) evento.preventDefault();

    if (sessionStorage.getItem("rol") !== "admin") {
        mostrarNotificacion("Solo el Administrador puede registrar colaboradores.", "error");
        return;
    }

    const elIdentidad = document.getElementById("identidad");
    const elNombres = document.getElementById("nombres_apellidos");
    const elGenero = document.getElementById("genero");
    const elTelefono = document.getElementById("telefono");
    const elDireccion = document.getElementById("direccion");

    const identidad = elIdentidad?.value.trim();
    const nombres_apellidos = elNombres?.value.trim();
    const genero = elGenero?.value;
    const telefono = elTelefono?.value.trim() || "";
    const direccion = elDireccion?.value.trim() || "";

    if (!identidad || !nombres_apellidos || !genero) {
        mostrarNotificacion("Por favor completa los campos requeridos (Identidad, Nombres y Género).", "error");
        return;
    }

    const nuevoColaborador = {
        identidad,
        nombres_apellidos,
        genero,
        telefono,
        direccion
    };

    console.log("Insertando colaborador en Supabase:", nuevoColaborador);

    try {
        const { error } = await supabaseClient
            .from("personal")
            .insert([nuevoColaborador]);

        console.log("Resultado insertar personal:", error);

        if (error) {
            mostrarNotificacion("Error al registrar colaborador: " + error.message, "error");
            return;
        }

        mostrarNotificacion("¡Colaborador registrado en el Equipo de la Boutique!", "success");
        document.getElementById("personalForm")?.reset();
        await cargarPersonal();
        await cargarSelectEmpleados();
    } catch (errEx) {
        console.error("Excepción en guardarPersonal:", errEx);
        mostrarNotificacion("Error inesperado al registrar colaborador: " + (errEx.message || errEx), "error");
    }
}

async function eliminarPersonal(identidad) {
    if (sessionStorage.getItem("rol") !== "admin") {
        mostrarNotificacion("Solo el Administrador puede retirar colaboradores.", "error");
        return;
    }

    const confirmado = await mostrarConfirmacion(
        "¿Estás seguro de que deseas retirar a este integrante del Equipo de la Boutique?"
    );
    if (!confirmado) return;

    try {
        console.log("Eliminando personal con identidad:", identidad);
        const { error } = await supabaseClient
            .from("personal")
            .delete()
            .eq("identidad", identidad);

        console.log("Resultado eliminar personal:", error);

        if (error) {
            mostrarNotificacion("Error al eliminar integrante: " + error.message, "error");
            return;
        }

        mostrarNotificacion("¡Integrante retirado del equipo correctamente!", "success");
        await cargarPersonal();
        await cargarSelectEmpleados();
        await cargarUsuarios();
    } catch (errEx) {
        console.error("Excepción en eliminarPersonal:", errEx);
        mostrarNotificacion("Error al eliminar integrante: " + (errEx.message || errEx), "error");
    }
}

async function cargarSelectEmpleados() {
    const select = document.getElementById("nuevoEmpleadoIdentidad");
    if (!select) return;

    try {
        console.log("Consultando personal para cargarSelectEmpleados()...");
        const { data: empleados, error } = await supabaseClient
            .from("personal")
            .select("identidad, nombres_apellidos")
            .order("nombres_apellidos", { ascending: true });

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
    } catch (err) {
        console.error("Excepción en cargarSelectEmpleados (no bloqueante):", err);
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
            .from("usuarios")
            .select("*")
            .order("usuario", { ascending: true });

        console.log("Resultado consulta usuarios:", usuarios, "Error:", error);

        if (error) {
            console.error("Error al cargar usuarios:", error);
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
                        </div>
                    </td>
                </tr>
            `;
            refrescarIconos();
            return;
        }

        if (!usuarios || usuarios.length === 0) {
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

        // Consultar colaboradores de personal para resolver identidad -> nombres_apellidos
        const mapaPersonal = {};
        try {
            const { data: personalList } = await supabaseClient
                .from("personal")
                .select("identidad, nombres_apellidos");
            if (personalList) {
                personalList.forEach(p => {
                    if (p.identidad) mapaPersonal[p.identidad] = p.nombres_apellidos;
                });
            }
        } catch (ePersonal) {
            console.warn("No se pudo mapear personal en usuarios:", ePersonal);
        }

        const usuarioLogueado = sessionStorage.getItem("usuario");
        const usuarioLogueadoId = Number(sessionStorage.getItem("usuarioId"));
        tableBody.innerHTML = "";

        usuarios.forEach(u => {
            const fila = document.createElement("tr");
            fila.className = "border-b border-slate-800/60 hover:bg-pink-500/5 transition-colors duration-150";

            // Columna 1: Usuario
            const celdaUsuario = `
                <div class="flex items-center gap-2">
                    <i data-lucide="user" class="w-4 h-4 text-pink-400"></i>
                    <span class="font-semibold text-slate-100">${escaparAtributo(u.usuario || "-")}</span>
                </div>
            `;

            // Columna 2: Rol en Sistema (u.rol con badge estilizado y su nombre legible)
            const rolCodigo = String(u.rol || "").trim().toLowerCase();
            let rolBadge = "";
            if (rolCodigo === "admin") {
                rolBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-500/15 text-pink-300 border border-pink-500/35"><i data-lucide="shield" class="w-3 h-3"></i>Administrador</span>`;
            } else if (rolCodigo === "encargado_inventario") {
                rolBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/35"><i data-lucide="shirt" class="w-3 h-3"></i>Encargado Inventario</span>`;
            } else if (rolCodigo === "encargado_proveedores") {
                rolBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/35"><i data-lucide="truck" class="w-3 h-3"></i>Encargado Proveedores</span>`;
            } else if (rolCodigo === "asesor") {
                rolBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35"><i data-lucide="tag" class="w-3 h-3"></i>Asesor de Moda</span>`;
            } else {
                rolBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700/50 text-slate-200 border border-slate-600"><i data-lucide="user-check" class="w-3 h-3"></i>${escaparAtributo(obtenerNombreRol(u.rol))}</span>`;
            }

            // Columna 3: Colaborador Vinculado
            let colaboradorTexto = `<span class="text-xs text-slate-500 italic">Sin vincular</span>`;
            if (u.identidad) {
                const nombreReal = mapaPersonal[u.identidad] || u.nombre || "Colaborador";
                colaboradorTexto = `
                    <div>
                        <span class="text-sm font-medium text-slate-200 block">${escaparAtributo(nombreReal)}</span>
                        <span class="text-[11px] text-pink-300/80 font-mono">${escaparAtributo(u.identidad)}</span>
                    </div>
                `;
            } else if (u.nombre && u.nombre !== u.usuario) {
                colaboradorTexto = `
                    <span class="text-sm font-medium text-slate-200 block">${escaparAtributo(u.nombre)}</span>
                `;
            }

            // Columna 4: Acciones
            const esMismoUsuario = u.usuario === usuarioLogueado || (u.id && Number(u.id) === usuarioLogueadoId);
            let celdaAccion = "";
            if (esMismoUsuario) {
                celdaAccion = `
                    <span class="inline-flex items-center gap-1 text-[11px] text-pink-400 bg-pink-500/10 border border-pink-500/30 px-2 py-1 rounded-lg font-medium">
                        <i data-lucide="user-check" class="w-3 h-3"></i>
                        <span>Sesión actual</span>
                    </span>
                `;
            } else {
                const idEliminar = u.usuario || u.id;
                celdaAccion = `
                    <button type="button"
                            data-usuario="${escaparAtributo(u.usuario || "")}"
                            data-id="${escaparAtributo(idEliminar || "")}"
                            class="btnEliminarUsuario inline-flex items-center gap-1.5 text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 hover:border-rose-400/50 transition">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        <span>Eliminar</span>
                    </button>
                `;
            }

            // Las columnas coinciden exactamente con el thead de personal.html:
            // 1: Usuario -> u.usuario
            // 2: Rol en Sistema -> rolBadge (u.rol formateado)
            // 3: Colaborador Vinculado -> colaboradorTexto (identidad vinculada de personal)
            // 4: Acciones -> botón eliminar o sesión actual
            fila.innerHTML = `
                <td class="py-3.5 px-4 font-semibold text-slate-100 whitespace-nowrap">${celdaUsuario}</td>
                <td class="py-3.5 px-4 whitespace-nowrap">${rolBadge}</td>
                <td class="py-3.5 px-4">${colaboradorTexto}</td>
                <td class="py-3.5 px-4 text-center whitespace-nowrap">${celdaAccion}</td>
            `;

            const btnEliminar = fila.querySelector(".btnEliminarUsuario");
            if (btnEliminar) {
                btnEliminar.addEventListener("click", () => {
                    eliminarUsuario(u.usuario || u.id);
                });
            }

            tableBody.appendChild(fila);
        });

        refrescarIconos();

    } catch (errEx) {
        console.error("Excepción inesperada en cargarUsuarios:", errEx);
        mostrarNotificacion("Error inesperado al cargar usuarios: " + (errEx.message || errEx), "error");
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="py-8 text-center text-rose-400">
                    <div class="inline-flex flex-col items-center gap-2 max-w-md mx-auto p-4 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 shadow-xl">
                        <div class="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                            <i data-lucide="alert-triangle" class="w-5 h-5 shrink-0"></i>
                            <span>Error de ejecución al cargar usuarios</span>
                        </div>
                        <p class="text-xs text-rose-200 font-mono break-all">${escaparAtributo(errEx.message || String(errEx))}</p>
                    </div>
                </td>
            </tr>
        `;
        refrescarIconos();
    }
}

async function guardarUsuario(evento) {
    if (evento && evento.preventDefault) evento.preventDefault();

    if (sessionStorage.getItem("rol") !== "admin") {
        mostrarNotificacion("Solo el Administrador puede gestionar usuarios.", "error");
        return;
    }

    const usuarioInput = (
        document.getElementById("nuevoUsuario") ||
        document.getElementById("loginUsuario")
    )?.value.trim();

    const passwordInput = (
        document.getElementById("nuevoPassword") ||
        document.getElementById("passwordUsuario")
    )?.value.trim();

    const rolInput = (
        document.getElementById("nuevoRol") ||
        document.getElementById("rolUsuario")
    )?.value;

    const identidadSelect = document.getElementById("nuevoEmpleadoIdentidad");
    const identidadInput = (identidadSelect && identidadSelect.value.trim()) ? identidadSelect.value.trim() : null;

    if (!usuarioInput || !passwordInput || !rolInput) {
        mostrarNotificacion("Completa todos los campos obligatorios del usuario.", "error");
        return;
    }

    const nuevoUsuarioObj = {
        usuario: usuarioInput,
        password: passwordInput,
        rol: rolInput,
        identidad: identidadInput
    };

    console.log("Insertando nuevo usuario en Supabase:", nuevoUsuarioObj);

    try {
        const { error } = await supabaseClient
            .from("usuarios")
            .insert([nuevoUsuarioObj]);

        console.log("Resultado inserción usuario, error:", error);

        if (error) {
            mostrarNotificacion("Error al registrar usuario: " + error.message, "error");
            return;
        }

        mostrarNotificacion(`¡Usuario "${usuarioInput}" registrado correctamente!`, "success");
        document.getElementById("usuarioForm")?.reset();
        await cargarUsuarios();
    } catch (errEx) {
        console.error("Excepción al guardar usuario:", errEx);
        mostrarNotificacion("Error al registrar usuario: " + (errEx.message || errEx), "error");
    }
}

async function eliminarUsuario(identificador) {
    if (sessionStorage.getItem("rol") !== "admin") {
        mostrarNotificacion("No tienes permiso para eliminar usuarios.", "error");
        return;
    }

    const confirmado = await mostrarConfirmacion(
        "¿Deseas eliminar este usuario del sistema?"
    );
    if (!confirmado) return;

    try {
        console.log("Eliminando usuario:", identificador);
        let { error } = await supabaseClient
            .from("usuarios")
            .delete()
            .eq("usuario", identificador);

        if (error && typeof identificador === "number") {
            const res = await supabaseClient
                .from("usuarios")
                .delete()
                .eq("id", identificador);
            error = res.error;
        }

        if (error) {
            mostrarNotificacion("Error al eliminar usuario: " + error.message, "error");
            return;
        }

        mostrarNotificacion("Usuario eliminado correctamente.", "success");
        await cargarUsuarios();
    } catch (errEx) {
        console.error("Excepción al eliminar usuario:", errEx);
        mostrarNotificacion("Error al eliminar usuario: " + (errEx.message || errEx), "error");
    }
}

/* ==========================================================================
   PASO 7: MÓDULO DE PROVEEDORES
   Tabla: proveedores
   Columnas esperadas: codigo (o PK), empresa, encargado, telefono, direccion, correo
   ========================================================================== */

let columnaClaveProveedor = "codigo"; // Se detecta automáticamente al cargar

async function cargarProveedores() {
    const tableBody = document.getElementById("proveedoresTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="7" class="py-10 text-center text-slate-400">
                <i data-lucide="loader-2" class="w-5 h-5 animate-spin inline mr-2"></i>
                Cargando proveedores...
            </td>
        </tr>
    `;
    refrescarIconos();

    // Consultamos sin .order("id") fijo para evitar fallo si la PK se llama "codigo"
    const { data: proveedores, error } = await supabaseClient
        .from("proveedores")
        .select("*");

    if (error) {
        console.error("Detalle error Supabase proveedores:", error);
        mostrarNotificacion("Error al cargar proveedores: " + error.message, "error");
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-rose-400">
                    Error al cargar proveedores: ${escaparAtributo(error.message)}
                </td>
            </tr>
        `;
        return;
    }

    if (!proveedores || proveedores.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="py-10 text-center text-slate-400">
                    No hay proveedores registrados aún.
                </td>
            </tr>
        `;
        return;
    }

    // Detectar automáticamente cómo se llama la columna clave primaria en Supabase
    const muestra = proveedores[0];
    if ("codigo" in muestra) columnaClaveProveedor = "codigo";
    else if ("id_proveedor" in muestra) columnaClaveProveedor = "id_proveedor";
    else if ("id" in muestra) columnaClaveProveedor = "id";

    // Ordenar del más reciente al más antiguo en el navegador
    proveedores.sort((a, b) => Number(b[columnaClaveProveedor] || 0) - Number(a[columnaClaveProveedor] || 0));

    tableBody.innerHTML = "";

    proveedores.forEach(prov => {
        const claveId = prov[columnaClaveProveedor];
        const fila = document.createElement("tr");
        fila.className = "border-b border-slate-800/60 hover:bg-pink-500/5 transition-colors";

        fila.innerHTML = `
            <td class="py-3.5 px-3 font-mono text-xs text-pink-300 font-semibold">
                ${escaparAtributo(claveId ?? "-")}
            </td>
            <td class="py-3.5 px-3 font-medium text-slate-100">
                ${escaparAtributo(prov.empresa || prov.nombre || "-")}
            </td>
            <td class="py-3.5 px-3 text-slate-300">
                ${escaparAtributo(prov.encargado || prov.contacto || "-")}
            </td>
            <td class="py-3.5 px-3 text-slate-300 whitespace-nowrap">
                ${escaparAtributo(prov.telefono || "-")}
            </td>
            <td class="py-3.5 px-3 text-slate-300">
                ${escaparAtributo(prov.direccion || "-")}
            </td>
            <td class="py-3.5 px-3 text-slate-300">
                ${escaparAtributo(prov.correo || "-")}
            </td>
            <td class="py-3.5 px-3 text-center">
                <div class="inline-flex items-center justify-center gap-2">
                    <button type="button" class="btnEditarProveedor inline-flex items-center gap-1.5 text-xs font-medium bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/35 px-2.5 py-1.5 rounded-lg">
                        <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                        Editar
                    </button>
                    <button type="button" class="btnEliminarProveedor inline-flex items-center gap-1.5 text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2.5 py-1.5 rounded-lg">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        Eliminar
                    </button>
                </div>
            </td>
        `;

        fila.querySelector(".btnEditarProveedor")?.addEventListener("click", () => {
            prepararEdicionProveedor(prov);
        });

        fila.querySelector(".btnEliminarProveedor")?.addEventListener("click", () => {
            eliminarProveedor(claveId);
        });

        tableBody.appendChild(fila);
    });

    refrescarIconos();
}

function prepararEdicionProveedor(prov) {
    proveedorEnEdicionId = prov[columnaClaveProveedor];

    if (document.getElementById("empresa")) {
        document.getElementById("empresa").value = prov.empresa || prov.nombre || "";
    }
    if (document.getElementById("encargado")) {
        document.getElementById("encargado").value = prov.encargado || prov.contacto || "";
    }
    if (document.getElementById("telefono_prov")) {
        document.getElementById("telefono_prov").value = prov.telefono || "";
    }
    if (document.getElementById("direccion_prov")) {
        document.getElementById("direccion_prov").value = prov.direccion || "";
    }
    if (document.getElementById("correo")) {
        document.getElementById("correo").value = prov.correo || "";
    }

    const titulo = document.getElementById("tituloProveedor");
    if (titulo) titulo.textContent = "Editar proveedor";

    const btnSubmit = document.getElementById("btnGuardarProveedor");
    if (btnSubmit) {
        btnSubmit.innerHTML = `
            <i data-lucide="save" class="w-4 h-4"></i>
            <span>Actualizar proveedor</span>
        `;
    }

    document.getElementById("btnCancelarProveedor")?.classList.remove("hidden");
    refrescarIconos();
}

function cancelarEdicionProveedor() {
    proveedorEnEdicionId = null;
    document.getElementById("proveedoresForm")?.reset();

    const titulo = document.getElementById("tituloProveedor");
    if (titulo) titulo.textContent = "Registrar proveedor";

    const btnSubmit = document.getElementById("btnGuardarProveedor");
    if (btnSubmit) {
        btnSubmit.innerHTML = `
            <i data-lucide="check" class="w-4 h-4"></i>
            <span>Registrar proveedor</span>
        `;
    }

    document.getElementById("btnCancelarProveedor")?.classList.add("hidden");
    refrescarIconos();
}

async function guardarProveedor(evento) {
    evento.preventDefault();

    const rolActual = sessionStorage.getItem("rol");
    if (rolActual !== "admin" && rolActual !== "encargado_proveedores") {
        mostrarNotificacion("No tienes permiso para gestionar proveedores.", "error");
        return;
    }

    const empresa = document.getElementById("empresa")?.value.trim();
    const encargado = document.getElementById("encargado")?.value.trim();
    const telefono = document.getElementById("telefono_prov")?.value.trim() || "";
    const direccion = document.getElementById("direccion_prov")?.value.trim() || "";
    const correo = document.getElementById("correo")?.value.trim() || "";

    if (!empresa || !encargado) {
        mostrarNotificacion("Empresa y representante son obligatorios.", "error");
        return;
    }

    const datos = { empresa, encargado, telefono, direccion, correo };
    let errorOp = null;

    if (proveedorEnEdicionId !== null) {
        const { error } = await supabaseClient
            .from("proveedores")
            .update(datos)
            .eq(columnaClaveProveedor, proveedorEnEdicionId);
        errorOp = error;
    } else {
        const { error } = await supabaseClient
            .from("proveedores")
            .insert([datos]);
        errorOp = error;
    }

    if (errorOp) {
        mostrarNotificacion("Error al guardar proveedor: " + errorOp.message, "error");
        return;
    }

    mostrarNotificacion(
        proveedorEnEdicionId !== null ? "¡Proveedor actualizado!" : "¡Proveedor registrado!",
        "success"
    );

    cancelarEdicionProveedor();
    await cargarProveedores();
}

async function eliminarProveedor(id) {
    const confirmado = await mostrarConfirmacion(
        "¿Estás seguro de que deseas eliminar este proveedor?"
    );
    if (!confirmado) return;

    const { error } = await supabaseClient
        .from("proveedores")
        .delete()
        .eq(columnaClaveProveedor, id);

    if (error) {
        mostrarNotificacion("Error al eliminar proveedor: " + error.message, "error");
        return;
    }

    if (proveedorEnEdicionId === id) {
        cancelarEdicionProveedor();
    }

    mostrarNotificacion("Proveedor eliminado.", "success");
    await cargarProveedores();
}

/* ==========================================================================
   PASO 8: CATÁLOGO PÚBLICO (index.html)
   ========================================================================== */

function renderizarCatalogoPublico(lista = []) {
    const grid = document.getElementById("catalogoPublicoGrid");
    if (!grid) return;

    if (lista.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-12 text-center text-slate-400">
                <i data-lucide="sparkles" class="w-8 h-8 mx-auto mb-2 text-pink-400"></i>
                <p class="font-medium">No se encontraron prendas disponibles.</p>
            </div>
        `;
        refrescarIconos();
        return;
    }

    grid.innerHTML = "";

    lista.forEach(prenda => {
        const urlImagen = obtenerUrlImagen(prenda.imagenes);
        const disponible = (Number(prenda.cantidad) || 0) > 0;

        const card = document.createElement("div");
        card.className = "neon-card rounded-2xl overflow-hidden border border-pink-500/25 flex flex-col justify-between transition hover:border-pink-400/60";

        const mediaHtml = urlImagen
            ? `<img src="${escaparAtributo(urlImagen)}" alt="${escaparAtributo(prenda.nombre)}" class="w-full h-64 object-cover" loading="lazy">`
            : `<div class="w-full h-64 bg-slate-900/80 flex items-center justify-center border-b border-pink-500/15">
                   <i data-lucide="shirt" class="w-12 h-12 text-pink-400/60"></i>
               </div>`;

        card.innerHTML = `
            <div>
                ${mediaHtml}
                <div class="p-4 space-y-2">
                    <h3 class="font-semibold text-slate-100 text-base leading-snug">
                        ${escaparAtributo(prenda.nombre)}
                    </h3>
                    <p class="text-lg font-bold text-pink-400">
                        ${formatearLempiras(prenda.precio)}
                    </p>
                </div>
            </div>
            <div class="px-4 pb-4 flex items-center justify-between">
                <span class="text-xs px-2.5 py-1 rounded-full font-medium ${
                    disponible
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                }">
                    ${disponible ? `${prenda.cantidad} disponibles` : "Agotado"}
                </span>
            </div>
        `;

        grid.appendChild(card);
    });

    refrescarIconos();
}

async function cargarCatalogoPublico() {
    const grid = document.getElementById("catalogoPublicoGrid");
    if (!grid) return;

    const { data: productos, error } = await supabaseClient
        .from("productos")
        .select("*")
        .gt("cantidad", 0)
        .order("id", { ascending: false });

    if (error) {
        console.error("Error al cargar catálogo público:", error);
        return;
    }

    catalogoPrendasPublico = productos || [];
    renderizarCatalogoPublico(catalogoPrendasPublico);
}

function filtrarCatalogoPublico(termino) {
    const texto = String(termino || "").toLowerCase().trim();
    if (!texto) {
        renderizarCatalogoPublico(catalogoPrendasPublico);
        return;
    }

    const filtrados = catalogoPrendasPublico.filter(p =>
        String(p.nombre || "").toLowerCase().includes(texto)
    );
    renderizarCatalogoPublico(filtrados);
}

/* ==========================================================================
   PASO 9: INICIALIZACIÓN AUTOMÁTICA POR PÁGINA
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    refrescarIconos();

    // Página de Login
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        verificarSesionEnLogin();
        loginForm.addEventListener("submit", iniciarSesion);
    }

    // Página de Inventario
    const productForm = document.getElementById("productForm");
    if (document.getElementById("productTableBody")) {
        if (protegerPagina(["admin", "encargado_inventario", "encargado_proveedores", "asesor"])) {
            configurarSidebarYHeader();
            aplicarPermisosInventario();
            cargarInventario();

            productForm?.addEventListener("submit", guardarProducto);
            document.getElementById("btnGenerarFotografia")?.addEventListener("click", generarFotografiaProducto);
            document.getElementById("btnCancelarEdicion")?.addEventListener("click", cancelarEdicionProducto);
            document.getElementById("btnCargarEjemplos")?.addEventListener("click", cargarProductosEjemplo);
        }
    }

    // Página de Personal / Usuarios
    if (document.getElementById("personalTableBody") || document.getElementById("usuariosTableBody")) {
        if (protegerPagina(["admin"])) {
            configurarSidebarYHeader();
            if (document.getElementById("personalTableBody")) {
                cargarPersonal();
            }
            if (document.getElementById("usuariosTableBody")) {
                cargarUsuarios();
                cargarSelectEmpleados();
            }
            const personalForm = document.getElementById("personalForm");
            if (personalForm && !personalForm.dataset.listenerAdjunto) {
                personalForm.dataset.listenerAdjunto = "true";
                personalForm.addEventListener("submit", guardarPersonal);
            }
            const usuarioForm = document.getElementById("usuarioForm");
            if (usuarioForm && !usuarioForm.dataset.listenerAdjunto) {
                usuarioForm.dataset.listenerAdjunto = "true";
                usuarioForm.addEventListener("submit", guardarUsuario);
            }
        }
    }
// Página de Proveedores
    const proveedorForm = document.getElementById("proveedoresForm");
    if (document.getElementById("proveedoresTableBody")) {
        if (protegerPagina(["admin", "encargado_proveedores"])) {
            configurarSidebarYHeader();
            cargarProveedores();
            proveedorForm?.addEventListener("submit", guardarProveedor);
            document.getElementById("btnCancelarProveedor")?.addEventListener("click", cancelarEdicionProveedor);
        }
    }

    // Catálogo Público
    if (document.getElementById("catalogoPublicoGrid")) {
        cargarCatalogoPublico();
        document.getElementById("buscadorCatalogoPublico")?.addEventListener("input", (e) => {
            filtrarCatalogoPublico(e.target.value);
        });
    }

    // Botón global de cerrar sesión
    document.getElementById("btnCerrarSesion")?.addEventListener("click", cerrarSesion);
    document.getElementById("btnCerrarSesionMobile")?.addEventListener("click", cerrarSesion);
});

