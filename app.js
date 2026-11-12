document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // FÉNIX RENACER: LOGIN & USER PORTAL LOGIC
    // ==========================================
    const appContainer = document.querySelector('.app-container');

    const userProfileMenu = document.getElementById('user-profile-menu');
    const headerAvatar = document.getElementById('header-avatar');
    const headerUsername = document.getElementById('header-username');
    const dropdownRole = document.getElementById('dropdown-role');
    const btnHome = document.getElementById('btn-home');

    let selectedRole = 'user';

    // Auto-login check: la cookie del servidor manda, no el localStorage.
    (function checkSession() {
        let cached = null;
        try { cached = JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch (e) { cached = null; }
        if (!cached) {
            window.location.href = 'index.html';
            return;
        }

        fetch('/api/me', { cache: 'no-store' })
            .then(response => {
                if (response.status === 401) {
                    window.location.href = 'index.html';
                    return null;
                }
                if (!response.ok) throw new Error('sin servidor');
                return response.json();
            })
            .then(data => {
                if (!data || !data.user) return;
                if (data.user.role !== 'admin' && data.user.role !== 'coordinador') {
                    window.location.href = 'index.html';
                    return;
                }
                selectedRole = data.user.role;
                localStorage.setItem('currentUser', JSON.stringify({
                    cedula: data.user.cedula,
                    nombre: data.user.nombre,
                    role: data.user.role,
                    login_time: cached.login_time || Date.now()
                }));
                updateUserSession(selectedRole);
            })
            .catch(() => {
                // Sin red: permitir la caché si el rol local es suficiente.
                if (cached.role === 'admin' || cached.role === 'coordinador') {
                    selectedRole = cached.role;
                    updateUserSession(selectedRole);
                } else {
                    window.location.href = 'index.html';
                }
            });
    })();

    // Function to update the session data in the dashboard header and apply role permissions
    function updateUserSession(role) {
        let nombreUsuario = role === 'admin' ? 'Admin' : 'Coordinador';
        try {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                const userObj = JSON.parse(savedUser);
                if (userObj && userObj.nombre) {
                    nombreUsuario = userObj.nombre;
                }
            }
        } catch (e) { }

        if (role === 'admin') {
            headerUsername.textContent = nombreUsuario;
            headerAvatar.innerHTML = '<i class="fa-solid fa-user-gear"></i>';
            dropdownRole.textContent = 'Administrador';
            document.querySelectorAll('.action-btn').forEach(b => b.style.display = 'inline-block');
            const addProdBtn = document.getElementById('btn-add-product');
            if (addProdBtn) addProdBtn.style.display = 'flex';
        } else if (role === 'coordinador') {
            headerUsername.textContent = nombreUsuario;
            headerAvatar.innerHTML = '<i class="fa-solid fa-users-gear"></i>';
            dropdownRole.textContent = 'Coordinador';
            document.querySelectorAll('.action-btn').forEach(b => b.style.display = 'none');
            const addProdBtn = document.getElementById('btn-add-product');
            if (addProdBtn) addProdBtn.style.display = 'none';

            // Restrict view-usuarios for 'coordinador'
            const navUsuarios = document.querySelector('.nav-item[data-target="view-usuarios"]');
            if (navUsuarios) navUsuarios.style.display = 'none';
        }
    }

    // Toggle Profile Dropdown
    userProfileMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        userProfileMenu.classList.toggle('active');
    });

    // Close dropdown on clicking anywhere else
    document.addEventListener('click', () => {
        userProfileMenu.classList.remove('active');
    });

    // Go Home click handler
    btnHome.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        userProfileMenu.classList.remove('active');

        // Redirigir a la pantalla inicial sin borrar la sesión
        window.location.href = 'index.html';
    });

    // Theme Toggle Logic
    const themeToggle = document.getElementById('theme-toggle');
    const root = document.documentElement;
    const body = document.body;

    // Check local storage for theme
    const currentTheme = localStorage.getItem('theme') || 'light';
    if (currentTheme === 'dark') {
        body.setAttribute('data-theme', 'dark');
        themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }

    themeToggle.addEventListener('click', () => {
        if (body.getAttribute('data-theme') === 'dark') {
            body.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
        } else {
            body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }
    });

    // Navigation Logic (SPA)
    const navItems = document.querySelectorAll('.nav-item');
    const viewSections = document.querySelectorAll('.view-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault(); // Previene que la página salte al inicio

            // 1. Marcar botón como activo
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // 2. Cambiar a la vista seleccionada
            const targetId = item.getAttribute('data-target');
            if (targetId) {
                viewSections.forEach(section => {
                    section.style.display = 'none'; // Ocultar todas
                });
                const targetSection = document.getElementById(targetId);
                if (targetSection) {
                    targetSection.style.display = 'block'; // Mostrar la seleccionada
                }
                // Cargar usuarios automáticamente al entrar a la vista
                if (targetId === 'view-usuarios') {
                    cargarUsuarios();
                }
            }

            // Ocultar sidebar en móviles tras hacer clic
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) sidebar.classList.remove('open');
            }
        });
    });

    // Modal Logic for Adding Products
    const btnAddProduct = document.getElementById('btn-add-product');
    const productModal = document.getElementById('product-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const addProductForm = document.getElementById('add-product-form');

    if (btnAddProduct && productModal) {
        btnAddProduct.addEventListener('click', () => {
            productModal.style.display = 'flex';
        });

        closeModalBtn.addEventListener('click', () => {
            productModal.style.display = 'none';
        });

        // Close on outside click
        productModal.addEventListener('click', (e) => {
            if (e.target === productModal) {
                productModal.style.display = 'none';
            }
        });

        addProductForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const code = document.getElementById('prod-code').value;
            const name = document.getElementById('prod-name').value;
            const stock = document.getElementById('prod-stock').value;
            const price = document.getElementById('prod-price').value;

            const tbody = document.querySelector('#products-table tbody');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${esc(code)}</td>
                <td>${esc(name)}</td>
                <td>Alimentos</td>
                <td><span class="badge-type badge-in">${stock}</span></td>
                <td>$${parseFloat(price).toFixed(2)}</td>
                <td>
                    <button class="action-btn edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn delete"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.prepend(tr);

            // Hide form and reset
            productModal.style.display = 'none';
            addProductForm.reset();
        });
    }



    // ==========================================
    // FUNCIÓN: CARGAR USUARIOS REGISTRADOS
    // ==========================================
    let _usuariosTodos = [];
    let _usuariosCountEl = null;
    let _usuariosTbody = null;
    let _usuariosFromLocal = false;

    function _normTexto(s) {
        return String(s == null ? '' : s)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    function renderUsuarios(users, countEl, tbody, fromLocal) {
        if (selectedRole !== 'admin') {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; color: #e74c3c; padding: 30px;">
                        <i class="fa-solid fa-lock" style="font-size: 2rem;"></i>
                        <p style="margin-top: 10px;">Acceso denegado. Solo administradores pueden ver esta sección.</p>
                    </td>
                </tr>`;
            if (countEl) countEl.textContent = '';
            document.getElementById('kpi-usuarios-count').textContent = '-';
            return;
        }

        _usuariosTodos = users || [];
        _usuariosCountEl = countEl;
        _usuariosTbody = tbody;
        _usuariosFromLocal = !!fromLocal;

        const kpiCount = document.getElementById('kpi-usuarios-count');
        if (kpiCount) kpiCount.textContent = _usuariosTodos.length;

        if (!_usuariosTodos.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; color: var(--text-muted); padding: 30px;">
                        <i class="fa-solid fa-user-slash" style="font-size: 2rem;"></i>
                        <p style="margin-top: 10px;">No hay usuarios registrados aún.</p>
                    </td>
                </tr>`;
            if (countEl) countEl.textContent = '';
            return;
        }

        pintarUsuarios();
    }

    /**
     * Dibuja la tabla aplicando el texto de #users-search y el rol de
     * #users-role-filter. Se llama al cargar y en cada tecla del buscador.
     */
    function pintarUsuarios() {
        const tbody = _usuariosTbody;
        if (!tbody) return;

        const searchEl = document.getElementById('users-search');
        const roleEl = document.getElementById('users-role-filter');
        const q = _normTexto(searchEl ? searchEl.value : '');
        const rolFiltro = roleEl ? roleEl.value : '';

        const filtrados = _usuariosTodos.filter(function (u) {
            const rol = u.role || 'user';
            if (rolFiltro && rol !== rolFiltro) return false;
            if (!q) return true;
            // Cédula, nombre y rol; sin distinguir mayúsculas ni acentos.
            return [u.nombre, u.cedula, rol].some(function (campo) {
                return _normTexto(campo).indexOf(q) !== -1;
            });
        });

        tbody.innerHTML = '';
        if (!filtrados.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; color: var(--text-muted); padding: 30px;">
                        <i class="fa-solid fa-magnifying-glass" style="font-size: 2rem;"></i>
                        <p style="margin-top: 10px;">No hay usuarios que coincidan con la búsqueda.</p>
                    </td>
                </tr>`;
            if (_usuariosCountEl)
                _usuariosCountEl.innerHTML = `Mostrando 0 de ${_usuariosTodos.length} usuario(s)`;
            return;
        }

        filtrados.forEach((u, i) => {
            const fecha = u.fecha
                ? new Date(u.fecha).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' })
                : 'Sin fecha';
            const inicial = (u.nombre || 'U').charAt(0).toUpperCase();

            let rolActual = u.role || 'user';

            // Si el que ve la tabla es Admin, puede cambiar roles
            let roleHtml = rolActual;
            let actionHtml = '';

            if (selectedRole === 'admin') {
                roleHtml = `
                    <select data-cedula="${esc(u.cedula)}" class="rol-select" style="padding: 6px; border-radius: 6px; border: 1px solid var(--border-color); outline: none;">
                        <option value="user" ${rolActual === 'user' ? 'selected' : ''}>User</option>
                        <option value="coordinador" ${rolActual === 'coordinador' ? 'selected' : ''}>Coordinador</option>
                        <option value="admin" ${rolActual === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                `;
                actionHtml = `<span style="font-size: 0.8rem; color: var(--text-muted);">Edición Habilitada</span>`;
            } else {
                actionHtml = `<span style="font-size: 0.8rem; color: var(--text-muted);">Solo Lectura</span>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${i + 1}</strong></td>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:36px; height:36px; border-radius:50%; background: linear-gradient(135deg, var(--primary-green), #0a4a2e); display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:0.9rem; flex-shrink:0;">
                            ${esc(inicial)}
                        </div>
                        <span style="font-weight:600;">${esc(u.nombre || 'Sin nombre')}</span>
                    </div>
                </td>
                <td>${esc(u.cedula || '—')}</td>
                <td>
                    <span style="font-family: monospace; letter-spacing: 2px; color: var(--text-muted);" title="Contraseña cifrada: no se puede mostrar">••••••</span>
                </td>
                <td>${roleHtml}</td>
                <td>${esc(fecha)}</td>
                <td>
                    <div style="display:flex; gap:5px; align-items:center;">
                        ${actionHtml}
                        <button data-cedula="${esc(u.cedula)}" data-nombre="${esc(u.nombre || '')}" class="btn-forzar-cierre" title="Forzar Cierre de Sesión" style="background:#e74c3c; color:white; border:none; border-radius:6px; padding:6px 10px; cursor:pointer;" class="action-btn">
                            <i class="fa-solid fa-power-off"></i>
                        </button>
                    </div>
                </td>
            `;

            // Los manejadores van por addEventListener con dataset: los datos
            // nunca se interpolan dentro de onclick/onchange.
            const selectRol = tr.querySelector('.rol-select');
            if (selectRol) {
                selectRol.addEventListener('change', function () {
                    window.cambiarRol(this.dataset.cedula, this.value);
                });
            }
            const btnCierre = tr.querySelector('.btn-forzar-cierre');
            if (btnCierre) {
                btnCierre.addEventListener('click', function () {
                    window.forzarCierreIndividual(this.dataset.cedula, this.dataset.nombre);
                });
            }

            tbody.appendChild(tr);
        });

        window.cambiarRol = function (cedula, nuevoRol) {
            // Se hace el cambio directamente sin confirmación molesta.
            fetch('/api/actualizar-rol', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cedula: cedula, newRole: nuevoRol })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        showToast('Rol actualizado correctamente', 'success');
                    } else {
                        showToast('Error: ' + data.message, 'error');
                    }
                    cargarUsuarios();
                })
                .catch(e => {
                    showToast('Error de conexión con el servidor', 'error');
                    cargarUsuarios();
                });
        };
        const src = _usuariosFromLocal ? ' <small style="color:var(--primary-yellow);">(sin servidor)</small>' : '';
        if (_usuariosCountEl) {
            _usuariosCountEl.innerHTML = filtrados.length === _usuariosTodos.length
                ? `Total: ${_usuariosTodos.length} usuario(s) registrado(s)${src}`
                : `Mostrando ${filtrados.length} de ${_usuariosTodos.length} usuario(s)${src}`;
        }
    }

    // Filtros de la tabla de usuarios (buscador + selector de rol)
    window.filtrarUsuarios = function () {
        pintarUsuarios();
    };

    window.limpiarFiltroUsuarios = function () {
        const searchEl = document.getElementById('users-search');
        const roleEl = document.getElementById('users-role-filter');
        if (searchEl) searchEl.value = '';
        if (roleEl) roleEl.value = '';
        pintarUsuarios();
        if (searchEl) searchEl.focus();
    };

    // Las contraseñas ya no viajan al navegador: la columna muestra solo puntos.


    window.forzarCierreGlobal = function () {
        if (!confirm("¿ESTÁS SEGURO? Todos los teléfonos activos regresarán al login inmediatamente y perderán cualquier conteo activo no guardado.")) return;
        fetch('/api/force-logout-all', { method: 'POST' })
            .then(() => alert('Orden de expulsión masiva enviada a la red.'))
            .catch(() => alert('Error de red al enviar la orden.'));
    };

    window.forzarCierreIndividual = function (cedula, nombre) {
        if (!confirm(`¿ESTÁS SEGURO de expulsar a ${nombre} (Cédula: ${cedula})?`)) return;
        fetch('/api/force-logout-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cedula })
        })
            .then(() => alert(`Expulsión programada para ${nombre}. Su dispositivo cerrará sesión en breve.`))
            .catch(() => alert('Error de red al aplicar expulsión.'));
    };

    window.cargarUsuarios = function () {
        const tbody = document.getElementById('users-tbody');
        const countEl = document.getElementById('users-count');
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; color: var(--text-muted); padding: 30px;">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem;"></i>
                    <p style="margin-top: 10px;">Cargando usuarios...</p>
                </td>
            </tr>`;
        if (countEl) countEl.textContent = '';

        // Primero intenta el servidor; si falla, usa localStorage
        fetch('/api/users')
            .then(res => {
                if (res.status === 401) {
                    window.location.href = 'index.html';
                    const err = new Error('unauthorized');
                    err.code = 401;
                    throw err;
                }
                if (!res.ok) throw new Error('server error');
                return res.json();
            })
            .then(users => renderUsuarios(users, countEl, tbody, false))
            .catch((err) => {
                if (err && err.code === 401) return;
                const stored = JSON.parse(localStorage.getItem('registeredUsers')) || [];
                renderUsuarios(stored, countEl, tbody, true);
            });
    };

    // Sidebar Mobile Toggle
    const menuBtn = document.getElementById('menu-btn');
    const closeBtn = document.getElementById('close-btn');
    const sidebar = document.getElementById('sidebar');

    menuBtn.addEventListener('click', () => {
        sidebar.classList.add('open');
    });

    closeBtn.addEventListener('click', () => {
        sidebar.classList.remove('open');
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });

    // The recent movements table will now be populated dynamically by sistema.html

    // The recent movements table will now be populated dynamically by sistema.html
    // (Chart.js code has been removed as the dashboard is being rebuilt from scratch)

    // ==========================================
    // CUSTOM TOAST NOTIFICATION
    // ==========================================
    window.showToast = function (message, type = 'success') {
        const toast = document.createElement('div');
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.padding = '12px 24px';
        toast.style.borderRadius = '8px';
        toast.style.background = type === 'success' ? '#166e47' : '#e74c3c';
        toast.style.color = 'white';
        toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
        toast.style.fontFamily = 'Inter, sans-serif';
        toast.style.fontWeight = '600';
        toast.style.zIndex = '9999';
        toast.style.transform = 'translateY(100px)';
        toast.style.opacity = '0';
        toast.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';

        toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation'}" style="margin-right: 8px;"></i> ${esc(message)}`;

        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        }, 10);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.transform = 'translateY(20px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

});
