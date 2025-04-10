// Inicialización de IndexedDB
const dbName = 'finanzasDB';
const dbVersion = 1;
let db;
let transacciones = []; // Variable global para almacenar transacciones
let comparisonChart; // Variable global para almacenar la instancia del gráfico
let categoryComparisonChart; // Variable global para la gráfica de comparación por categoría

function initDB() {
    const request = indexedDB.open(dbName, dbVersion);
    request.onupgradeneeded = (e) => {
        db = e.target.result;
        // Crear almacén para transacciones si no existe
        if (!db.objectStoreNames.contains('transacciones')) {
            db.createObjectStore('transacciones', { keyPath: 'id', autoIncrement: true });
        }
        // Crear almacén para gastos estimados si no existe
        if (!db.objectStoreNames.contains('gastosEstimados')) {
            db.createObjectStore('gastosEstimados', { keyPath: 'id', autoIncrement: true });
        }
    };
    request.onsuccess = (e) => {
        db = e.target.result;
        // Cargar datos iniciales
        cargarTransacciones();
        cargarGastosEstimados();
    };
    request.onerror = (e) => {
        console.error('Error al abrir la base de datos', e);
    };
}

// Funciones generales de IndexedDB (agregar, listar, filtrar, actualizar, eliminar)

// Manejo de transacciones
function mostrarNotificacion(mensaje) {
    const notification = document.getElementById('notification');
    notification.textContent = mensaje;
    notification.classList.add('active');
    setTimeout(() => {
        notification.classList.remove('active');
    }, 3000);
}

function agregarTransaccion(transactionData) {
    transactionData.amount = parseFloat(transactionData.amount) || 0; // Asegurar que amount sea numérico
    const transaction = db.transaction(['transacciones'], 'readwrite');
    const store = transaction.objectStore('transacciones');
    store.add(transactionData);
    transaction.oncomplete = () => {
        mostrarNotificacion('Transacción agregada con éxito.');
        cargarTransacciones(); // Recargar transacciones para actualizar balance
        document.getElementById('transaction-form').reset(); // Limpiar formulario
    };
    transaction.onerror = (e) => {
        console.error('Error al agregar transacción', e);
    };
}

function mostrarTransaccionesEnLista(transacciones) {
    const transactionsList = document.getElementById('transactions-list');
    transactionsList.innerHTML = '';
    transacciones.forEach((t) => {
        const item = document.createElement('div');
        item.className = 'transaction-item';

        // Mostrar tipo con texto "Ingreso" o "Egreso"
        const typeSpan = document.createElement('span');
        typeSpan.className = t.type === 'ingreso' ? 'ingreso' : 'egreso';
        typeSpan.textContent = (t.type === 'ingreso') ? 'Ingreso' : 'Egreso';

        // Mostrar detalles
        const details = document.createElement('span');
        details.textContent = ` | ${t.category} | $${t.amount} | ${t.date}`;

        // Contenedor para los botones
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'buttons-container';

        // Botón de editar
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = 'Editar';
        editBtn.onclick = () => editarTransaccion(t);

        // Botón de eliminar
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Eliminar';
        deleteBtn.onclick = () => confirmarEliminacion(t.id);

        buttonsContainer.appendChild(editBtn);
        buttonsContainer.appendChild(deleteBtn);
        item.appendChild(typeSpan); // Mostrar "Ingreso" o "Egreso"
        item.appendChild(details);
        item.appendChild(buttonsContainer);
        transactionsList.appendChild(item);
    });

    // Limitar la lista a un tamaño visible de 3 elementos con scroll
    transactionsList.style.maxHeight = '150px';
    transactionsList.style.overflowY = 'auto';
}

function confirmarEliminacion(id) {
    const modal = document.getElementById('delete-modal');
    modal.classList.add('active');

    document.getElementById('confirm-delete').onclick = () => {
        eliminarTransaccion(id);
        modal.classList.remove('active');
    };

    document.getElementById('cancel-delete').onclick = () => {
        modal.classList.remove('active');
    };
}

function eliminarTransaccion(id) {
    const transaction = db.transaction(['transacciones'], 'readwrite');
    const store = transaction.objectStore('transacciones');
    store.delete(id);
    transaction.oncomplete = () => {
        mostrarNotificacion('Transacción eliminada con éxito.');
        cargarTransacciones();
    };
    transaction.onerror = (e) => {
        console.error('Error al eliminar transacción', e);
    };
}

function editarTransaccion(transaccion) {
    const type = document.getElementById('type');
    const amount = document.getElementById('amount');
    const date = document.getElementById('date');
    const category = document.getElementById('category');

    // Rellenar el formulario con los datos de la transacción
    type.value = transaccion.type;
    amount.value = transaccion.amount;
    date.value = transaccion.date;
    category.value = transaccion.category;

    // Cambiar el botón de agregar a guardar cambios
    const submitButton = document.querySelector('#transaction-form button[type="submit"]');
    submitButton.textContent = 'Guardar Cambios';

    submitButton.onclick = (e) => {
        e.preventDefault();
        const updatedTransaction = {
            id: transaccion.id,
            type: type.value,
            amount: parseFloat(amount.value) || 0,
            date: date.value,
            category: category.value
        };

        const transaction = db.transaction(['transacciones'], 'readwrite');
        const store = transaction.objectStore('transacciones');
        store.put(updatedTransaction);
        transaction.oncomplete = () => {
            mostrarNotificacion('Transacción actualizada con éxito.');
            cargarTransacciones();
            submitButton.textContent = 'Agregar'; // Restaurar el botón
            submitButton.onclick = null; // Restaurar el evento original
        };
        transaction.onerror = (e) => {
            console.error('Error al actualizar transacción', e);
        };
    };
}

function generarGraficoComparacion(transacciones) {
    const ctx = document.getElementById('comparison-chart').getContext('2d');
    const ingresos = transacciones.filter(t => t.type === 'ingreso').reduce((sum, t) => sum + t.amount, 0);
    const egresos = transacciones.filter(t => t.type === 'egreso').reduce((sum, t) => sum + t.amount, 0);

    if (comparisonChart) {
        comparisonChart.destroy();
    }

    comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Ingresos', 'Egresos'],
            datasets: [{
                label: 'Comparación de Finanzas',
                data: [ingresos, egresos],
                backgroundColor: ['#4caf50', '#f44336']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true },
                tooltip: { enabled: true }
            }
        }
    });
}

function generarGraficoComparacionConEstimados(gastosEstimados) {
    const ctx = document.getElementById('comparison-chart').getContext('2d');
    const ingresos = transacciones.filter(t => t.type === 'ingreso').reduce((sum, t) => sum + t.amount, 0);
    const egresos = transacciones.filter(t => t.type === 'egreso').reduce((sum, t) => sum + t.amount, 0);
    const estimados = gastosEstimados.reduce((sum, g) => sum + g.amount, 0);

    if (comparisonChart) {
        comparisonChart.destroy();
    }

    comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Ingresos', 'Egresos', 'Estimados'],
            datasets: [{
                label: 'Comparación de Finanzas',
                data: [ingresos, egresos, estimados],
                backgroundColor: ['#4caf50', '#f44336', '#ff9800']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true },
                tooltip: { enabled: true }
            }
        }
    });
}

function generarGraficoComparacionPorCategoria(transacciones, gastosEstimados) {
    const ctx = document.getElementById('category-comparison-chart').getContext('2d');

    const categorias = [...new Set([...transacciones.map(t => t.category), ...gastosEstimados.map(g => g.category)])];
    const gastosRealesPorCategoria = categorias.map(cat => 
        transacciones.filter(t => t.category === cat && t.type === 'egreso').reduce((sum, t) => sum + t.amount, 0)
    );
    const gastosEstimadosPorCategoria = categorias.map(cat => 
        gastosEstimados.filter(g => g.category === cat).reduce((sum, g) => sum + g.amount, 0)
    );

    if (categoryComparisonChart) {
        categoryComparisonChart.destroy();
    }

    categoryComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: categorias,
            datasets: [
                {
                    label: 'Gastos Reales',
                    data: gastosRealesPorCategoria,
                    backgroundColor: '#f44336',
                    barThickness: 20
                },
                {
                    label: 'Gastos Estimados',
                    data: gastosEstimadosPorCategoria,
                    backgroundColor: '#ff9800',
                    barThickness: 20
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true },
                tooltip: { enabled: true }
            },
            scales: {
                x: { title: { display: true, text: 'Categorías' } },
                y: { title: { display: true, text: 'Monto ($)' } }
            }
        }
    });
}

function actualizarBalance() {
    let incomes = 0;
    let expenses = 0;
    transacciones.forEach(t => {
        const amount = parseFloat(t.amount) || 0;
        if (t.type === 'ingreso') {
            incomes += amount;
        } else if (t.type === 'egreso') {
            expenses += amount;
        }
    });
    const balance = incomes - expenses;
    const balanceValue = document.getElementById('balance-value');
    balanceValue.textContent = balance.toFixed(2);
    balanceValue.className = balance >= 0 ? 'balance-positive' : 'balance-negative';
}

// Manejo de pestañas
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));

        button.classList.add('active');
        document.getElementById(button.dataset.tab).classList.add('active');

        // Actualizar gráficas al cambiar de pestaña
        if (button.dataset.tab === 'transactions-tab') {
            generarGraficoComparacion(transacciones);
        } else if (button.dataset.tab === 'estimated-expenses-tab') {
            cargarGastosEstimados();
        }
    });
});

function actualizarFiltros(transacciones) {
    const years = new Set();
    const months = new Set();

    transacciones.forEach(t => {
        const year = new Date(t.date).getFullYear();
        const month = new Date(t.date).toISOString().slice(0, 7); // YYYY-MM
        years.add(year);
        months.add(month);
    });

    const yearFilter = document.getElementById('filter-year');
    const monthFilter = document.getElementById('filter-month');

    yearFilter.innerHTML = '';
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });

    monthFilter.innerHTML = '';
    months.forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = new Date(month).toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        monthFilter.appendChild(option);
    });
}

function cargarTransacciones() {
    const transaction = db.transaction(['transacciones'], 'readonly');
    const store = transaction.objectStore('transacciones');
    const request = store.getAll();
    request.onsuccess = (e) => {
        transacciones = e.target.result || []; // Asegurar que transacciones sea un array
        console.log('Transacciones cargadas:', transacciones); // Verificar contenido
        mostrarTransaccionesEnLista(transacciones);
        actualizarBalance(); // Asegurar que se actualice el balance
        generarGraficoComparacion(transacciones);
        cargarGastosEstimados(); // Actualizar comparación por categoría
        actualizarFiltros(transacciones);
    };
    request.onerror = (e) => {
        console.error('Error al cargar transacciones', e);
    };
}

// Manejo de gastos estimados
function mostrarGastosEstimadosEnLista(gastosEstimados) {
    const estimatedExpensesList = document.getElementById('estimated-expenses-list');
    estimatedExpensesList.innerHTML = '';
    gastosEstimados.forEach((g) => {
        const item = document.createElement('div');
        item.className = 'estimated-expense-item';

        // Detalles del gasto estimado
        const details = document.createElement('span');
        details.textContent = `${g.month} | ${g.category} | $${g.amount}`;

        // Contenedor para los botones
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'buttons-container';

        // Botón de editar
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = 'Editar';
        editBtn.onclick = () => actualizarGastoEstimado(g);

        // Botón de borrar
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Borrar';
        deleteBtn.onclick = () => confirmarEliminacionGastoEstimado(g.id);

        buttonsContainer.appendChild(editBtn);
        buttonsContainer.appendChild(deleteBtn);
        item.appendChild(details);
        item.appendChild(buttonsContainer);
        estimatedExpensesList.appendChild(item);
    });

    // Limitar la lista a un tamaño visible de 3 elementos con scroll
    estimatedExpensesList.style.maxHeight = '150px';
    estimatedExpensesList.style.overflowY = 'auto';
}

function confirmarEliminacionGastoEstimado(id) {
    const modal = document.getElementById('delete-modal');
    modal.classList.add('active');

    document.getElementById('confirm-delete').onclick = () => {
        eliminarGastoEstimado(id);
        modal.classList.remove('active');
    };

    document.getElementById('cancel-delete').onclick = () => {
        modal.classList.remove('active');
    };
}

function eliminarGastoEstimado(id) {
    const transaction = db.transaction(['gastosEstimados'], 'readwrite');
    const store = transaction.objectStore('gastosEstimados');
    store.delete(id);
    transaction.oncomplete = () => {
        mostrarNotificacion('Gasto estimado eliminado con éxito.');
        cargarGastosEstimados();
    };
    transaction.onerror = (e) => {
        console.error('Error al eliminar gasto estimado', e);
    };
}

function actualizarGastoEstimado(gasto) {
    const month = document.getElementById('month');
    const categoryEstimated = document.getElementById('category-estimated');
    const amountEstimated = document.getElementById('amount-estimated');

    // Rellenar el formulario con los datos del gasto estimado
    month.value = gasto.month;
    categoryEstimated.value = gasto.category;
    amountEstimated.value = gasto.amount;

    // Cambiar el botón de agregar a guardar cambios
    const submitButton = document.querySelector('#estimated-expenses-form button[type="submit"]');
    submitButton.textContent = 'Guardar Cambios';

    submitButton.onclick = (e) => {
        e.preventDefault();
        const updatedGasto = {
            id: gasto.id,
            month: month.value,
            category: categoryEstimated.value,
            amount: parseFloat(amountEstimated.value) || 0
        };

        const transaction = db.transaction(['gastosEstimados'], 'readwrite');
        const store = transaction.objectStore('gastosEstimados');
        store.put(updatedGasto);
        transaction.oncomplete = () => {
            mostrarNotificacion('Gasto estimado actualizado con éxito.');
            cargarGastosEstimados();
            submitButton.textContent = 'Agregar'; // Restaurar el botón
            submitButton.onclick = null; // Restaurar el evento original
        };
        transaction.onerror = (e) => {
            console.error('Error al actualizar gasto estimado', e);
        };
    };
}

function agregarGastoEstimado(estimadoData) {
    const transaction = db.transaction(['gastosEstimados'], 'readonly');
    const store = transaction.objectStore('gastosEstimados');
    const request = store.getAll();

    request.onsuccess = (e) => {
        const gastosEstimados = e.target.result;

        // Verificar si ya existe un gasto estimado en la misma categoría
        const existeCategoria = gastosEstimados.some(g => g.category === estimadoData.category);
        if (existeCategoria) {
            mostrarNotificacion('No es posible agregar otro gasto estimado en esta categoría.');
            return;
        }

        // Si no existe, agregar el nuevo gasto estimado
        const transactionAdd = db.transaction(['gastosEstimados'], 'readwrite');
        const storeAdd = transactionAdd.objectStore('gastosEstimados');
        storeAdd.add(estimadoData);
        transactionAdd.oncomplete = () => {
            mostrarNotificacion('Gasto estimado agregado con éxito.');
            cargarGastosEstimados();
            document.getElementById('estimated-expenses-form').reset(); // Limpiar formulario
        };
        transactionAdd.onerror = (e) => {
            console.error('Error al agregar gasto estimado', e);
        };
    };

    request.onerror = (e) => {
        console.error('Error al verificar gastos estimados', e);
    };
}

function cargarGastosEstimados() {
    const transaction = db.transaction(['gastosEstimados'], 'readonly');
    const store = transaction.objectStore('gastosEstimados');
    const request = store.getAll();
    request.onsuccess = (e) => {
        const gastosEstimados = e.target.result;
        mostrarGastosEstimadosEnLista(gastosEstimados);
        generarGraficoComparacionPorCategoria(transacciones, gastosEstimados); // Comparar con transacciones
    };
    request.onerror = (e) => {
        console.error('Error al cargar gastos estimados', e);
    };
}

// Filtrado y actualización de la interfaz
function aplicarFiltros() {
    // Implementar lógica de filtrado
    console.log('Filtros aplicados');
}

// Lógica para agregar categorías personalizadas
function agregarCategoriaPersonalizada(categoria) {
    const categorySelect = document.getElementById('category');
    const categoryEstimatedSelect = document.getElementById('category-estimated');

    if (!categorySelect || !categoryEstimatedSelect) {
        console.error('No se encontraron los selectores de categorías.');
        return;
    }

    // Crear nueva opción para las categorías
    const newOption = document.createElement('option');
    newOption.value = categoria.toLowerCase();
    newOption.textContent = categoria;

    // Agregar la nueva categoría a ambos select
    categorySelect.appendChild(newOption.cloneNode(true));
    categoryEstimatedSelect.appendChild(newOption);

    mostrarNotificacion(`Categoría "${categoria}" agregada con éxito.`);
}

// Validar existencia del formulario antes de agregar el evento
const customCategoryForm = document.getElementById('custom-category-form');
if (customCategoryForm) {
    customCategoryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const customCategoryInput = document.getElementById('custom-category');
        if (!customCategoryInput) {
            console.error('No se encontró el campo de entrada para la categoría personalizada.');
            return;
        }

        const nuevaCategoria = customCategoryInput.value.trim();
        if (nuevaCategoria) {
            agregarCategoriaPersonalizada(nuevaCategoria);
            customCategoryInput.value = ''; // Limpiar el campo de entrada
        } else {
            mostrarNotificacion('Por favor, ingresa un nombre válido para la categoría.');
        }
    });
} else {
    console.error('No se encontró el formulario de categoría personalizada.');
}

// Eventos de los formularios y botones
document.getElementById('transaction-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('type').value;
    const amount = parseFloat(document.getElementById('amount').value) || 0;
    const date = document.getElementById('date').value;
    const category = document.getElementById('category').value;
    const transactionData = {
        type,
        amount,
        date,
        category
    };
    agregarTransaccion(transactionData);
});

document.getElementById('estimated-expenses-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const month = document.getElementById('month').value;
    const categoryEstimated = document.getElementById('category-estimated').value;
    const amountEstimated = parseFloat(document.getElementById('amount-estimated').value) || 0;

    if (!month || !categoryEstimated || amountEstimated <= 0) {
        mostrarNotificacion('Por favor, completa todos los campos correctamente.');
        return;
    }

    const estimadoData = {
        month,
        category: categoryEstimated,
        amount: amountEstimated
    };

    agregarGastoEstimado(estimadoData);
});

// Inicializar
window.addEventListener('DOMContentLoaded', () => {
    initDB();
});
