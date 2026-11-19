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

/*
   La columna imagenes de Supabase es JSONB.
   Se admiten arreglos de URL, cadenas JSON y objetos con URL.
*/

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
    const rol = sessionStorage.getItem("rol");

    if (!usuario || !rol) {
        window.location.replace("login.html");
        return false;
    }

    if (
        rolesPermitidos.length > 0 &&
        !rolesPermitidos.includes(rol)
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
        { nombre: "Bufanda de cachemira estampada - Única", cantidad: 16, precio: 320.00 }
    ];

    // imagenes es JSONB, por eso cada producto inicia con un arreglo vacío.
    const productosConImagenes = productosEjemplo.map(producto => ({
        ...producto,
        imagenes: []
    }));

    const { error } = await supabaseClient
        .from("productos")
        .insert(productosConImagenes);

    if (error) {
        mostrarNotificacion(
            "Error al cargar productos de ejemplo: " + error.message,
            "error"
        );
    } else {
        mostrarNotificacion(
            "¡15 prendas de ejemplo cargadas con éxito!",
            "success"
        );

        await cargarInventario();
    }
}

/* ==========================================================================
   PASO 6: MÓDULO DE PERSONAL
   Tabla: personal
   ========================================================================== */

function actualizarResumenPersonal(listaPersonal = []) {
    const elTotal = document.getElementById("statTotalPersonal");
    const elMasc = document.getElementById("statPersonalMasculino");
    const elFem = document.getElementById("statPersonalFemenino");

    const total = listaPersonal.length;

    const masculino = listaPersonal.filter(
        p => String(p.genero).toLowerCase() === "masculino"
    ).length;

    const femenino = listaPersonal.filter(
        p => String(p.genero).toLowerCase() === "femenino"
    ).length;

    if (elTotal) elTotal.textContent = total;
    if (elMasc) elMasc.textContent = masculino;
    if (elFem) elFem.textContent = femenino;
}

async function cargarPersonal() {
    const tableBody =
        document.getElementById("personalTableBody");

    if (!tableBody) return;

    const { data: listaPersonal, error } = await supabaseClient
        .from("personal")
        .select("*");

    if (error) {
        console.error("Error al cargar personal:", error);

        mostrarNotificacion(
            "Error al cargar el equipo: " + error.message,
            "error"
        );

        actualizarResumenPersonal([]);
        return;
    }

    actualizarResumenPersonal(listaPersonal || []);

    if (!listaPersonal || listaPersonal.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="py-10 text-center text-slate-400">
                    No hay integrantes registrados aún.
                </td>
            </tr>
        `;

        return;
    }

    tableBody.innerHTML = "";

    listaPersonal.forEach(persona => {
        const fila = document.createElement("tr");

        fila.className =
            "border-b border-slate-800/60 hover:bg-pink-500/5 transition-colors";

        fila.innerHTML = `
            <td class="py-3.5 px-4 text-pink-300 font-semibold">
                ${escaparAtributo(persona.identidad)}
            </td>

            <td class="py-3.5 px-4 text-slate-100 font-medium">
                ${escaparAtributo(persona.nombres_apellidos)}
            </td>

            <td class="py-3.5 px-4 text-slate-300">
                ${escaparAtributo(persona.genero)}
            </td>

            <td class="py-3.5 px-4 text-slate-300">
                ${escaparAtributo(persona.telefono)}
            </td>

            <td class="py-3.5 px-4 text-slate-400">
                ${escaparAtributo(persona.direccion)}
            </td>

            <td class="py-3.5 px-4 text-center">
                <button
                    type="button"
                    data-identidad="${escaparAtributo(persona.identidad)}"
                    onclick="eliminarPersonal(this.dataset.identidad)"
                    class="inline-flex items-center gap-1.5 text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2.5 py-1.5 rounded-lg">

                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    Eliminar
                </button>
            </td>
        `;

        tableBody.appendChild(fila);
    });

    refrescarIconos();
}

async function eliminarPersonal(identidad) {
    if (sessionStorage.getItem("rol") !== "admin") {
        mostrarNotificacion(
            "Solo el Administrador puede retirar colaboradores.",
            "error"
        );
        return;
    }

    const confirmado = await mostrarConfirmacion(
        "¿Estás seguro de que deseas retirar a este integrante del equipo?"
    );

    if (!confirmado) return;

    const { error } = await supabaseClient
        .from("personal")
        .delete()
        .eq("identidad", identidad);

    if (error) {
        mostrarNotificacion(
            "Error al eliminar integrante: " + error.message,
            "error"
        );
        return;
    }

    mostrarNotificacion(
        "¡Integrante retirado del equipo correctamente!",
        "success"
    );

    await cargarPersonal();
    await cargarSelectEmpleados();
    await cargarUsuarios();
}

/* ==========================================================================
   PASO 7: GESTIÓN DE USUARIOS
   Tabla: usuarios
   ========================================================================== */

async function cargarSelectEmpleados() {
    const select =
        document.getElementById("nuevoEmpleadoIdentidad");

    if (!select) return;

    const { data: empleados, error } = await supabaseClient
        .from("personal")
        .select("identidad, nombres_apellidos")
        .order("nombres_apellidos", { ascending: true });

    if (error) {
        console.error("Error al cargar empleados:", error);
        return;
    }

    select.innerHTML =
        `<option value="">-- Sin vincular a colaborador --</option>`;

    (empleados || []).forEach(emp => {
        const opt = document.createElement("option");

        opt.value = emp.identidad;

        opt.textContent =
            `${emp.nombres_apellidos} (${emp.identidad})`;

        select.appendChild(opt);
    });
}

async function cargarUsuarios() {
    const tableBody =
        document.getElementById("usuariosTableBody");

    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="4" class="py-8 text-center text-slate-400">
                Cargando cuentas de usuario...
            </td>
        </tr>
    `;

    try {
        const { data: usuarios, error } = await supabaseClient
            .from("usuarios")
            .select("*")
            .order("usuario", { ascending: true });

        if (error) {
            console.error("Error al cargar usuarios:", error);

            mostrarNotificacion(
                "Error al cargar usuarios: " + error.message,
                "error"
            );

            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="py-8 text-center text-rose-400">
                        Error al consultar la tabla usuarios.
                    </td>
                </tr>
            `;

            return;
        }

        const { data: listaPersonal } = await supabaseClient
            .from("personal")
            .select("identidad, nombres_apellidos");

        const mapaPersonal = {};

        (listaPersonal || []).forEach(p => {
            mapaPersonal[p.identidad] = p.nombres_apellidos;
        });

        if (!usuarios || usuarios.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="py-10 text-center text-slate-400">
                        No hay cuentas de usuario registradas.
                    </td>
                </tr>
            `;

            return;
        }

        const usuarioLogueado =
            sessionStorage.getItem("usuario");

        tableBody.innerHTML = "";

        usuarios.forEach(u => {
            const fila = document.createElement("tr");

            fila.className =
                "border-b border-slate-800/60 hover:bg-pink-500/5 transition-colors";

            const roles = {
                admin: "Administrador",
                encargado_inventario: "Encargado Inventario",
                encargado_proveedores: "Encargado Proveedores",
                asesor: "Asesor de Moda"
            };

            const rolTexto = roles[u.rol] || u.rol;

            const colaborador = u.identidad
                ? `
                    <div>
                        <span class="text-sm font-medium text-slate-200 block">
                            ${escaparAtributo(mapaPersonal[u.identidad] || "Colaborador")}
                        </span>

                        <span class="text-xs text-pink-300 font-mono">
                            ${escaparAtributo(u.identidad)}
                        </span>
                    </div>
                `
                : `<span class="text-xs text-slate-500 italic">Sin vincular</span>`;

            const accion = u.usuario === usuarioLogueado
                ? `
                    <span class="text-xs text-pink-400">
                        Sesión actual
                    </span>
                `
                : `
                    <button
                        type="button"
                        data-usuario="${escaparAtributo(u.usuario)}"
                        onclick="eliminarUsuario(this.dataset.usuario)"
                        class="inline-flex items-center gap-1.5 text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2.5 py-1.5 rounded-lg">

                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        Eliminar
                    </button>
                `;

            fila.innerHTML = `
                <td class="py-3.5 px-4 font-semibold text-slate-100">
                    ${escaparAtributo(u.usuario)}
                </td>

                <td class="py-3.5 px-4 text-slate-300">
                    ${escaparAtributo(rolTexto)}
                </td>

                <td class="py-3.5 px-4">
                    ${colaborador}
                </td>

                <td class="py-3.5 px-4 text-center">
                    ${accion}
                </td>
            `;

            tableBody.appendChild(fila);
        });

        refrescarIconos();

    } catch (error) {
        console.error("Error inesperado al cargar usuarios:", error);

        mostrarNotificacion(
            "Error al cargar usuarios: " + error.message,
            "error"
        );
    }
}

async function eliminarUsuario(nombreUsuario) {
    if (sessionStorage.getItem("rol") !== "admin") {
        mostrarNotificacion(
            "Solo el Administrador puede eliminar usuarios.",
            "error"
        );
        return;
    }

    if (nombreUsuario === sessionStorage.getItem("usuario")) {
        mostrarNotificacion(
            "No puedes eliminar tu propia cuenta.",
            "error"
        );
        return;
    }

    const confirmado = await mostrarConfirmacion(
        `¿Estás seguro de eliminar la cuenta "${nombreUsuario}"?`
    );

    if (!confirmado) return;

    const { error } = await supabaseClient
        .from("usuarios")
        .delete()
        .eq("usuario", nombreUsuario);

    if (error) {
        mostrarNotificacion(
            "Error al eliminar usuario: " + error.message,
            "error"
        );
        return;
    }

    mostrarNotificacion(
        `Usuario "${nombreUsuario}" eliminado correctamente.`,
        "success"
    );

    await cargarUsuarios();
}

/* ==========================================================================
   PASO 8: MÓDULO DE PROVEEDORES
   Tabla: proveedores
   ========================================================================== */

async function cargarProveedores() {
    const tableBody =
        document.getElementById("proveedoresTableBody");

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
                    No hay proveedores registrados aún.
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
            <td class="py-3 px-3 text-sky-400 font-bold">
                #${escaparAtributo(prov.codigo)}
            </td>

            <td class="py-3 px-3 text-slate-200">
                ${escaparAtributo(prov.empresa)}
            </td>

            <td class="py-3 px-3 text-slate-300">
                ${escaparAtributo(prov.encargado)}
            </td>

            <td class="py-3 px-3 text-slate-300">
                ${escaparAtributo(prov.telefono)}
            </td>

            <td class="py-3 px-3 text-slate-400">
                ${escaparAtributo(prov.direccion)}
            </td>

            <td class="py-3 px-3 text-slate-400">
                ${escaparAtributo(prov.correo)}
            </td>

            <td class="py-3 px-3 text-center">
                <div class="inline-flex items-center justify-center gap-2">

                    <button
                        type="button"
                        data-accion="editar"
                        data-id="${escaparAtributo(prov.codigo)}"
                        class="inline-flex items-center gap-1.5 text-xs font-medium bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/35 px-2.5 py-1.5 rounded-lg">

                        <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                        Editar
                    </button>

                    <button
                        type="button"
                        data-accion="eliminar"
                        data-id="${escaparAtributo(prov.codigo)}"
                        class="inline-flex items-center gap-1.5 text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2.5 py-1.5 rounded-lg">

                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        Eliminar
                    </button>

                </div>
            </td>
        `;

        tableBody.appendChild(fila);
    });

    refrescarIconos();
}

function cancelarEdicionProveedor() {
    proveedorEnEdicionId = null;

    document.getElementById("proveedoresForm")?.reset();

    const titulo =
        document.getElementById("tituloProveedor");

    if (titulo) {
        titulo.textContent = "Registrar proveedor";
    }

    const botonGuardar =
        document.getElementById("btnGuardarProveedor");

    if (botonGuardar) {
        botonGuardar.innerHTML = `
            <i data-lucide="check" class="w-4 h-4"></i>
            <span>Registrar proveedor</span>
        `;
    }

    document.getElementById("btnCancelarProveedor")
        ?.classList.add("hidden");

    refrescarIconos();
}

/* ==========================================================================
   PASO 9: CATÁLOGO PÚBLICO
   ========================================================================== */

async function cargarCatalogoPublico() {
    const contenedor =
        document.getElementById("catalogoPublicoGrid");

    if (!contenedor) return;

    contenedor.innerHTML = `
        <div class="col-span-full py-16 text-center text-slate-400">
            Cargando colección de prendas...
        </div>
    `;

    const { data: productos, error } = await supabaseClient
        .from("productos")
        .select("*")
        .order("id", { ascending: false });

    if (error) {
        console.error("Error al cargar catálogo:", error);

        contenedor.innerHTML = `
            <div class="col-span-full py-12 text-center text-rose-400">
                No se pudo cargar la colección de prendas.
            </div>
        `;

        return;
    }

    catalogoPrendasPublico = productos || [];

    renderizarCatalogoPublico(catalogoPrendasPublico);
}

function renderizarCatalogoPublico(prendas) {
    const contenedor =
        document.getElementById("catalogoPublicoGrid");

    if (!contenedor) return;

    if (!prendas || prendas.length === 0) {
        contenedor.innerHTML = `
            <div class="col-span-full py-16 text-center text-slate-400">
                No se encontraron prendas.
            </div>
        `;

        return;
    }

    contenedor.innerHTML = "";

    prendas.forEach(prenda => {
        const cantidad = Number(prenda.cantidad) || 0;

        let badgeHtml = "";

        if (cantidad <= 0) {
            badgeHtml = `
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                    Agotado
                </span>
            `;
        } else if (cantidad <= 5) {
            badgeHtml = `
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Pocas unidades (${cantidad})
                </span>
            `;
        } else {
            badgeHtml = `
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    Disponible
                </span>
            `;
        }

        const urlImagen = obtenerUrlImagen(prenda.imagenes);

        const imagenHtml = urlImagen
            ? `
                <img
                    src="${escaparAtributo(urlImagen)}"
                    alt="${escaparAtributo(prenda.nombre)}"
                    class="w-full h-56 object-cover rounded-xl mb-4"
                    loading="lazy"
                >
            `
            : `
                <div class="w-full h-56 rounded-xl mb-4 bg-gradient-to-br from-pink-500/10 to-violet-500/10 border border-pink-500/20 flex items-center justify-center">
                    <i data-lucide="shirt" class="w-12 h-12 text-pink-400"></i>
                </div>
            `;

        const tarjeta = document.createElement("article");

        tarjeta.className =
            "neon-card p-5 rounded-2xl flex flex-col justify-between group transition-all duration-300 hover:-translate-y-1";

        tarjeta.innerHTML = `
            <div>
                ${imagenHtml}

                <div class="flex items-center justify-between gap-2 mb-3">
                    ${badgeHtml}
                </div>

                <h3 class="text-base font-bold text-slate-100 leading-snug">
                    ${escaparAtributo(prenda.nombre)}
                </h3>
            </div>

            <div class="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">

                <div>
                    <p class="text-xs uppercase font-semibold tracking-wider text-slate-400">
                        Precio
                    </p>

                    <p class="text-lg font-extrabold text-pink-400">
                        ${formatearLempiras(prenda.precio)}
                    </p>
                </div>

                <div class="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                    <i data-lucide="sparkles" class="w-4 h-4"></i>
                </div>

            </div>
        `;

        contenedor.appendChild(tarjeta);
    });

    refrescarIconos();
}

function filtrarCatalogoPublico(termino) {
    const query = String(termino || "")
        .toLowerCase()
        .trim();

    if (!query) {
        renderizarCatalogoPublico(catalogoPrendasPublico);
        return;
    }

    const filtrados = catalogoPrendasPublico.filter(item =>
        String(item.nombre || "")
            .toLowerCase()
            .includes(query)
    );

    renderizarCatalogoPublico(filtrados);
}

/* ==========================================================================
   PASO 10: FORMULARIOS Y EVENTOS
   ========================================================================== */

function inicializarFormulariosYEventos() {

    /* ----------------------------------------------------------------------
       1. LOGIN
       ---------------------------------------------------------------------- */

    const loginForm = document.getElementById("loginForm");

    if (loginForm && !loginForm.dataset.listenerAdjunto) {
        loginForm.dataset.listenerAdjunto = "true";

        loginForm.addEventListener("submit", async evento => {
            evento.preventDefault();

            const usuarioInput =
                document.getElementById("usuario").value.trim();

            const passwordInput =
                document.getElementById("password").value.trim();

            const btnLogin =
                document.getElementById("btnLogin");

            if (!usuarioInput || !passwordInput) {
                mostrarNotificacion(
                    "Por favor ingresa usuario y contraseña.",
                    "error"
                );
                return;
            }

            if (btnLogin) {
                btnLogin.disabled = true;

                btnLogin.innerHTML = `
                    <i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>
                    <span>Verificando...</span>
                `;

                refrescarIconos();
            }

            try {
                const { data: usuarioData, error: errorUsuario } =
                    await supabaseClient
                        .from("usuarios")
                        .select("*")
                        .eq("usuario", usuarioInput)
                        .eq("password", passwordInput)
                        .maybeSingle();

                if (errorUsuario) {
                    mostrarNotificacion(
                        "Error al verificar credenciales: " +
                        errorUsuario.message,
                        "error"
                    );

                    restaurarBotonLogin();
                    return;
                }

                if (!usuarioData) {
                    const { count, error: countErr } =
                        await supabaseClient
                            .from("usuarios")
                            .select("*", {
                                count: "exact",
                                head: true
                            });

                    if (
                        !countErr &&
                        count === 0 &&
                        usuarioInput === "admin" &&
                        passwordInput === "1234"
                    ) {
                        const { error: insErr } =
                            await supabaseClient
                                .from("usuarios")
                                .insert([{
                                    usuario: "admin",
                                    password: "1234",
                                    rol: "admin",
                                    identidad: null
                                }]);

                        if (!insErr) {
                            sessionStorage.setItem("usuario", "admin");
                            sessionStorage.setItem("rol", "admin");
                            sessionStorage.setItem("nombre", "Administrador Principal");

                            mostrarNotificacion(
                                "Administrador inicial registrado. Entrando...",
                                "success"
                            );

                            setTimeout(() => {
                                window.location.href = "inventario.html";
                            }, 800);

                            return;
                        }
                    }

                    mostrarNotificacion(
                        "Usuario o contraseña incorrectos.",
                        "error"
                    );

                    restaurarBotonLogin();
                    return;
                }

                let nombreMostrar = usuarioData.usuario;

                if (usuarioData.identidad) {
                    const { data: personalData } =
                        await supabaseClient
                            .from("personal")
                            .select("nombres_apellidos")
                            .eq("identidad", usuarioData.identidad)
                            .maybeSingle();

                    if (personalData?.nombres_apellidos) {
                        nombreMostrar = personalData.nombres_apellidos;
                    }
                }

                sessionStorage.setItem(
                    "usuario",
                    usuarioData.usuario
                );

                sessionStorage.setItem(
                    "rol",
                    usuarioData.rol
                );

                sessionStorage.setItem(
                    "nombre",
                    nombreMostrar
                );

                if (usuarioData.identidad) {
                    sessionStorage.setItem(
                        "identidad",
                        usuarioData.identidad
                    );
                } else {
                    sessionStorage.removeItem("identidad");
                }

                mostrarNotificacion(
                    `¡Bienvenido/a, ${nombreMostrar}! (${obtenerNombreRol(usuarioData.rol)})`,
                    "success"
                );

                setTimeout(() => {
                    window.location.href = "inventario.html";
                }, 800);

            } catch (error) {
                console.error("Error en login:", error);

                mostrarNotificacion(
                    "Error al iniciar sesión: " + error.message,
                    "error"
                );

                restaurarBotonLogin();
            }
        });
    }

    /* ----------------------------------------------------------------------
       2. FORMULARIO DE PRODUCTOS
       ---------------------------------------------------------------------- */

    const productForm =
        document.getElementById("productForm");

    if (productForm && !productForm.dataset.listenerAdjunto) {
        productForm.dataset.listenerAdjunto = "true";

        productForm.addEventListener("submit", async evento => {
            evento.preventDefault();

            const rolActual = sessionStorage.getItem("rol");

            if (
                rolActual !== "admin" &&
                rolActual !== "encargado_inventario"
            ) {
                mostrarNotificacion(
                    "No tienes permiso para registrar ni editar prendas.",
                    "error"
                );
                return;
            }

            const nombreIngresado =
                document.getElementById("nombre").value.trim();

            const cantidadIngresada =
                Number(document.getElementById("cantidad").value);

            const precioIngresado =
                Number(document.getElementById("precio").value);

            if (
                !nombreIngresado ||
                !Number.isFinite(cantidadIngresada) ||
                cantidadIngresada < 0 ||
                !Number.isFinite(precioIngresado) ||
                precioIngresado < 0
            ) {
                mostrarNotificacion(
                    "Verifica el nombre, la cantidad y el precio.",
                    "error"
                );
                return;
            }

            const botonSubmit =
                productForm.querySelector("button[type='submit']");

            if (botonSubmit) botonSubmit.disabled = true;

            try {
                if (idProductoEditando === null) {

                    // JSONB recibe un arreglo de URL, no una cadena.
                    const nuevoProducto = {
                        nombre: nombreIngresado,
                        cantidad: cantidadIngresada,
                        precio: precioIngresado,
                        imagenes: imagenProductoGenerada
                            ? [imagenProductoGenerada]
                            : []
                    };

                    const { error } = await supabaseClient
                        .from("productos")
                        .insert([nuevoProducto]);

                    if (error) throw error;

                    mostrarNotificacion(
                        "¡Prenda agregada al catálogo!",
                        "success"
                    );

                } else {

                    const productoActualizado = {
                        nombre: nombreIngresado,
                        cantidad: cantidadIngresada,
                        precio: precioIngresado
                    };

                    /*
                       Si se generó una fotografía nueva, se guarda como
                       arreglo JSONB. Si no se generó otra, no se modifica
                       imagenes y se conserva la fotografía existente.
                    */

                    if (imagenProductoGenerada) {
                        productoActualizado.imagenes = [
                            imagenProductoGenerada
                        ];
                    }

                    const { error } = await supabaseClient
                        .from("productos")
                        .update(productoActualizado)
                        .eq("id", idProductoEditando);

                    if (error) throw error;

                    mostrarNotificacion(
                        "¡Prenda actualizada con éxito!",
                        "success"
                    );
                }

                cancelarEdicionProducto();

                await cargarInventario();

                if (document.getElementById("catalogoPublicoGrid")) {
                    await cargarCatalogoPublico();
                }

            } catch (error) {
                console.error("Error al guardar producto:", error);

                mostrarNotificacion(
                    "Error al guardar prenda: " + error.message,
                    "error"
                );

            } finally {
                if (botonSubmit) botonSubmit.disabled = false;
            }
        });
    }

    /* ----------------------------------------------------------------------
       3. BOTÓN PARA GENERAR FOTOGRAFÍA
       ---------------------------------------------------------------------- */

    const btnGenerarFotografia =
        document.getElementById("btnGenerarFotografia");

    if (
        btnGenerarFotografia &&
        !btnGenerarFotografia.dataset.listenerAdjunto
    ) {
        btnGenerarFotografia.dataset.listenerAdjunto = "true";

        btnGenerarFotografia.addEventListener(
            "click",
            generarFotografiaProducto
        );
    }

    /* ----------------------------------------------------------------------
       4. CANCELAR EDICIÓN DE PRODUCTO
       ---------------------------------------------------------------------- */

    const btnCancelarEdicion =
        document.getElementById("btnCancelarEdicion");

    if (
        btnCancelarEdicion &&
        !btnCancelarEdicion.dataset.listenerAdjunto
    ) {
        btnCancelarEdicion.dataset.listenerAdjunto = "true";

        btnCancelarEdicion.addEventListener(
            "click",
            cancelarEdicionProducto
        );
    }

    /* ----------------------------------------------------------------------
       5. FORMULARIO DE PERSONAL
       ---------------------------------------------------------------------- */

    const personalForm =
        document.getElementById("personalForm");

    if (personalForm && !personalForm.dataset.listenerAdjunto) {
        personalForm.dataset.listenerAdjunto = "true";

        personalForm.addEventListener("submit", async e => {
            e.preventDefault();

            if (sessionStorage.getItem("rol") !== "admin") {
                mostrarNotificacion(
                    "Solo el Administrador puede registrar colaboradores.",
                    "error"
                );
                return;
            }

            const nuevoColaborador = {
                identidad: document.getElementById("identidad").value.trim(),
                nombres_apellidos: document.getElementById("nombres_apellidos").value.trim(),
                genero: document.getElementById("genero").value,
                telefono: document.getElementById("telefono").value.trim(),
                direccion: document.getElementById("direccion").value.trim()
            };

            const { error } = await supabaseClient
                .from("personal")
                .insert([nuevoColaborador]);

            if (error) {
                mostrarNotificacion(
                    "Error al registrar colaborador: " + error.message,
                    "error"
                );
                return;
            }

            mostrarNotificacion(
                "¡Colaborador registrado correctamente!",
                "success"
            );

            personalForm.reset();

            await cargarPersonal();
            await cargarSelectEmpleados();
        });
    }

    /* ----------------------------------------------------------------------
       6. FORMULARIO DE CREAR USUARIOS
       ---------------------------------------------------------------------- */

    const usuarioForm =
        document.getElementById("usuarioForm");

    if (usuarioForm && !usuarioForm.dataset.listenerAdjunto) {
        usuarioForm.dataset.listenerAdjunto = "true";

        usuarioForm.addEventListener("submit", async e => {
            e.preventDefault();

            if (sessionStorage.getItem("rol") !== "admin") {
                mostrarNotificacion(
                    "Solo el Administrador puede registrar usuarios.",
                    "error"
                );
                return;
            }

            const usuarioVal =
                document.getElementById("nuevoUsuario").value.trim();

            const passwordVal =
                document.getElementById("nuevoPassword").value.trim();

            const rolVal =
                document.getElementById("nuevoRol").value;

            const identidadSelect =
                document.getElementById("nuevoEmpleadoIdentidad");

            const identidadVal =
                identidadSelect?.value.trim() || null;

            if (!usuarioVal || !passwordVal || !rolVal) {
                mostrarNotificacion(
                    "Completa los campos obligatorios del usuario.",
                    "error"
                );
                return;
            }

            const nuevoUsuarioObj = {
                usuario: usuarioVal,
                password: passwordVal,
                rol: rolVal,
                identidad: identidadVal
            };

            const { error } = await supabaseClient
                .from("usuarios")
                .insert([nuevoUsuarioObj]);

            if (error) {
                mostrarNotificacion(
                    "Error al crear usuario: " + error.message,
                    "error"
                );
                return;
            }

            mostrarNotificacion(
                `¡Cuenta "${usuarioVal}" creada exitosamente!`,
                "success"
            );

            usuarioForm.reset();

            await cargarUsuarios();
        });
    }

    /* ----------------------------------------------------------------------
       7. FORMULARIO DE PROVEEDORES
       ---------------------------------------------------------------------- */

    const proveedoresForm =
        document.getElementById("proveedoresForm");

    if (proveedoresForm && !proveedoresForm.dataset.listenerAdjunto) {
        proveedoresForm.dataset.listenerAdjunto = "true";

        proveedoresForm.addEventListener("submit", async e => {
            e.preventDefault();

            const rolActual = sessionStorage.getItem("rol");

            if (
                rolActual !== "admin" &&
                rolActual !== "encargado_proveedores"
            ) {
                mostrarNotificacion(
                    "No tienes permiso para gestionar proveedores.",
                    "error"
                );
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
                resultado = await supabaseClient
                    .from("proveedores")
                    .update(proveedor)
                    .eq("codigo", proveedorEnEdicionId);
            } else {
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

            mostrarNotificacion(
                proveedorEnEdicionId !== null
                    ? "Proveedor actualizado correctamente."
                    : "Proveedor registrado correctamente.",
                "success"
            );

            cancelarEdicionProveedor();

            await cargarProveedores();
        });
    }

    /* ----------------------------------------------------------------------
       8. BOTONES DE EDITAR Y ELIMINAR PROVEEDORES
       ---------------------------------------------------------------------- */

    const proveedoresTableBody =
        document.getElementById("proveedoresTableBody");

    if (
        proveedoresTableBody &&
        !proveedoresTableBody.dataset.listenerAdjunto
    ) {
        proveedoresTableBody.dataset.listenerAdjunto = "true";

        proveedoresTableBody.addEventListener("click", async e => {
            const boton = e.target.closest("button[data-accion]");

            if (!boton) return;

            const rolActual = sessionStorage.getItem("rol");

            if (
                rolActual !== "admin" &&
                rolActual !== "encargado_proveedores"
            ) {
                mostrarNotificacion(
                    "No tienes permisos para modificar proveedores.",
                    "error"
                );
                return;
            }

            const codigo = boton.dataset.id;
            const accion = boton.dataset.accion;

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

                const titulo =
                    document.getElementById("tituloProveedor");

                if (titulo) {
                    titulo.textContent = "Editar proveedor";
                }

                const botonGuardar =
                    document.getElementById("btnGuardarProveedor");

                if (botonGuardar) {
                    botonGuardar.innerHTML = `
                        <i data-lucide="save" class="w-4 h-4"></i>
                        <span>Actualizar proveedor</span>
                    `;
                }

                document.getElementById("btnCancelarProveedor")
                    ?.classList.remove("hidden");

                refrescarIconos();
            }

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

    /* ----------------------------------------------------------------------
       9. CANCELAR EDICIÓN DE PROVEEDOR
       ---------------------------------------------------------------------- */

    const btnCancelarProveedor =
        document.getElementById("btnCancelarProveedor");

    if (
        btnCancelarProveedor &&
        !btnCancelarProveedor.dataset.listenerAdjunto
    ) {
        btnCancelarProveedor.dataset.listenerAdjunto = "true";

        btnCancelarProveedor.addEventListener(
            "click",
            cancelarEdicionProveedor
        );
    }

    /* ----------------------------------------------------------------------
       10. BUSCADOR DEL CATÁLOGO PÚBLICO
       ---------------------------------------------------------------------- */

    const inputBusquedaCatalogo =
        document.getElementById("inputBusquedaCatalogo");

    if (
        inputBusquedaCatalogo &&
        !inputBusquedaCatalogo.dataset.listenerAdjunto
    ) {
        inputBusquedaCatalogo.dataset.listenerAdjunto = "true";

        inputBusquedaCatalogo.addEventListener("input", e => {
            filtrarCatalogoPublico(e.target.value);
        });
    }
}

/* ==========================================================================
   PASO 11: INICIALIZACIÓN GENERAL DEL SISTEMA
   ========================================================================== */

function inicializarSistema() {
    refrescarIconos();

    inicializarFormulariosYEventos();

    configurarSidebarYHeader();

    aplicarPermisosInventario();

    if (document.getElementById("catalogoPublicoGrid")) {
        cargarCatalogoPublico();
    }

    if (document.getElementById("productTableBody")) {
        cargarInventario();
    }

    if (document.getElementById("personalTableBody")) {
        cargarPersonal();
    }

    if (document.getElementById("usuariosTableBody")) {
        cargarUsuarios();
        cargarSelectEmpleados();
    }

    if (document.getElementById("proveedoresTableBody")) {
        cargarProveedores();
    }
}

/* ==========================================================================
   INICIO DEL SISTEMA
   ========================================================================== */

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        inicializarSistema
    );
} else {
    inicializarSistema();
}


