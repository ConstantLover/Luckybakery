// Datos del menú (fallback local)
const fallbackMenuItems = [
    {
        id: 1,
        nombre: "Galletas de chispas con helado",
        descripcion: "Galletas artesanales con helado de vainilla",
        precio: 12.00,
        imagen: "https://i.postimg.cc/SsN7QH69/Copilot-20250804-213734.png",
        disponible: 8
    },
    {
        id: 2,
        nombre: "Pan de Banano",
        descripcion: "El clásico pan de banano con nueces",
        precio: 6.00,
        imagen: "https://i.postimg.cc/HkNV8R15/Copilot-20250804-214620.png",
        disponible: 12
    },
    {
        id: 3,
        nombre: "Campechanas",
        descripcion: "Deliciosas campechanas horneadas",
        precio: 3.00,
        imagen: "https://i.postimg.cc/3JVTXTWK/Copilot-20250804-215035.png",
        disponible: 15
    }
];

let menuItems = [...fallbackMenuItems];

// Configuración de la API de Google Apps Script
const API_URL = 'https://script.google.com/macros/s/AKfycbyiRd-DyOX83OqalzAyeT_XCIJik6iNyGjORM4tTJFlWSrThMiJFteSdbbu7mZBaBsxug/exec';

// Función para generar número de orden único
function generateOrderNumber() {
    const timestamp = Date.now().toString();
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD-${timestamp.slice(-4)}-${randomNum}`;
}

// Cargar inventario desde Google Sheets
async function loadInventoryFromSheets() {
    try {
        const loadingElement = document.getElementById('loading-menu');
        if (loadingElement) loadingElement.style.display = 'block';

        const response = await fetch(`${API_URL}?action=getInventory`);
        const data = await response.json();

        if (data.success && data.inventory) {
            // Actualizar disponibilidad de productos existentes
            menuItems.forEach(item => {
                if (data.inventory[item.id]) {
                    item.disponible = data.inventory[item.id].disponible;
                }
            });
            console.log('Inventario cargado desde Google Sheets');
            displayMenuItems();
            populateProductSelect();
        }
    } catch (error) {
        console.warn('No se pudo cargar el inventario desde Sheets, usando datos locales:', error);
        displayMenuItems();
        populateProductSelect();
    } finally {
        const loadingElement = document.getElementById('loading-menu');
        if (loadingElement) loadingElement.style.display = 'none';
    }
}

// Mostrar productos en el menú
function displayMenuItems() {
    const menuGrid = document.querySelector('.menu-grid');
    
    if (!menuGrid) return;
    
    menuGrid.innerHTML = '';
    
    menuItems.forEach(item => {
        const stockClass = item.disponible === 0 ? 'out-of-stock' : 
                          item.disponible <= 3 ? 'low-stock' : 'in-stock';
        const stockText = item.disponible === 0 ? 'AGOTADO' : 
                         item.disponible <= 3 ? `ÚLTIMOS ${item.disponible}` : `Disponible: ${item.disponible}`;
        
        const menuItem = document.createElement('div');
        menuItem.className = 'menu-item';
        menuItem.innerHTML = `
            <div class="img-container">
                <img src="${item.imagen}" alt="${item.nombre}" class="menu-item-img" loading="lazy">
            </div>
            <div class="menu-item-content">
                <h3>${item.nombre}</h3>
                <p>${item.descripcion}</p>
                <p class="menu-item-price">Q${item.precio.toFixed(2)}</p>
                <p class="menu-item-stock ${stockClass}">
                    ${stockText}
                </p>
            </div>
        `;
        menuGrid.appendChild(menuItem);
    });
}

// Llenar el select de productos
function populateProductSelect() {
    const select = document.getElementById('producto');
    
    if (!select) return;
    
    // Limpiar opciones existentes
    select.innerHTML = '<option value="" disabled selected>Selecciona un producto</option>';
    
    // Añadir solo productos disponibles
    menuItems.forEach(item => {
        if (item.disponible > 0) {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.nombre} - Q${item.precio.toFixed(2)}`;
            option.dataset.price = item.precio;
            select.appendChild(option);
        }
    });
    
    // Actualizar precio unitario cuando se selecciona un producto
    select.addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        if (selectedOption.value) {
            document.getElementById('precio_unitario').value = selectedOption.dataset.price;
            updateTotal();
        }
    });
}

// Actualizar el total del pedido
function updateTotal() {
    const cantidad = parseInt(document.getElementById('cantidad').value) || 0;
    const precioUnitario = parseFloat(document.getElementById('precio_unitario').value) || 0;
    const total = cantidad * precioUnitario;
    document.getElementById('total').value = total.toFixed(2);
}

// Manejar el envío del formulario
function handleFormSubmit(event) {
    event.preventDefault();
    
    const orderNumber = generateOrderNumber();
    document.getElementById('orderNumberDisplay').textContent = orderNumber;
    
    // Crear resumen del pedido
    const formData = new FormData(event.target);
    const orderSummary = document.getElementById('orderSummary');
    orderSummary.innerHTML = `
        <p><strong>Nombre:</strong> ${formData.get('nombre')}</p>
        <p><strong>Teléfono:</strong> ${formData.get('telefono')}</p>
        <p><strong>Producto:</strong> ${document.getElementById('producto').options[document.getElementById('producto').selectedIndex].text}</p>
        <p><strong>Cantidad:</strong> ${formData.get('cantidad')}</p>
        <p><strong>Total:</strong> Q${formData.get('total')}</p>
        ${formData.get('mensaje') ? `<p><strong>Instrucciones:</strong> ${formData.get('mensaje')}</p>` : ''}
    `;
    
    // Mostrar confirmación
    document.getElementById('pedidoForm').style.display = 'none';
    document.getElementById('orderConfirmation').style.display = 'block';
    
    // Enviar datos a Google Sheets (opcional)
    sendOrderToSheets(formData, orderNumber);
}

// Enviar pedido a Google Sheets
async function sendOrderToSheets(formData, orderNumber) {
    try {
        const orderData = {
            action: 'submitOrder',
            nombre: formData.get('nombre'),
            telefono: formData.get('telefono'),
            producto_id: formData.get('producto'),
            producto_nombre: document.getElementById('producto').options[document.getElementById('producto').selectedIndex].text,
            cantidad: formData.get('cantidad'),
            total: formData.get('total'),
            mensaje: formData.get('mensaje'),
            orderNumber: orderNumber
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(orderData)
        });

        const data = await response.json();
        if (!data.success) {
            console.error('Error al enviar el pedido:', data.message);
        }
    } catch (error) {
        console.error('Error al enviar el pedido:', error);
    }
}

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', function() {
    // Cargar menú e inventario
    loadInventoryFromSheets();
    
    // Configurar eventos
    document.getElementById('cantidad').addEventListener('input', updateTotal);
    document.getElementById('pedidoForm').addEventListener('submit', handleFormSubmit);
    
    // Botón para nuevo pedido
    document.getElementById('newOrderBtn').addEventListener('click', function() {
        document.getElementById('pedidoForm').style.display = 'block';
        document.getElementById('orderConfirmation').style.display = 'none';
        document.getElementById('pedidoForm').reset();
    });
    
    // Actualizar año actual en el footer
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Menú móvil
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const mobileMenu = document.querySelector('.mobile-menu');
    const overlay = document.querySelector('.overlay');
    
    if (mobileMenuBtn && mobileMenu && overlay) {
        mobileMenuBtn.addEventListener('click', function() {
            mobileMenu.classList.toggle('active');
            overlay.classList.toggle('active');
        });
        
        overlay.addEventListener('click', function() {
            mobileMenu.classList.remove('active');
            overlay.classList.remove('active');
        });
    }
});