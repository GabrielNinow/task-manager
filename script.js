document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const loginPage = document.getElementById('loginPage');
    const taskManagerPage = document.getElementById('taskManagerPage');
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userEmail = document.getElementById('userEmail');
    const createTaskBtn = document.getElementById('createTaskBtn');
    
    const taskInput = document.getElementById('taskInput');
    const dueDate = document.getElementById('dueDate');
    const dueTime = document.getElementById('dueTime');
    const tagSelect = document.getElementById('tagSelect');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const taskList = document.getElementById('taskList');
    
    const dateFilter = document.getElementById('dateFilter');
    const tagFilter = document.getElementById('tagFilter');
    const statusFilter = document.getElementById('statusFilter');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    
    const createTaskModal = document.getElementById('createTaskModal');
    const cancelCreateTaskBtn = document.getElementById('cancelCreateTask');
    const createTaskModalClose = createTaskModal.querySelector('.modal-close');
    const createTaskModalBackground = createTaskModal.querySelector('.modal-background');
    
    const deleteModal = document.getElementById('deleteModal');
    const cancelDeleteBtn = document.getElementById('cancelDelete');
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    const modalClose = deleteModal.querySelector('.modal-close');
    const modalBackground = deleteModal.querySelector('.modal-background');

    let tasks = [];
    let currentDateFilter = 'all';
    let currentTagFilter = 'all';
    let currentStatusFilter = 'all';
    let taskToDelete = null;

    // Initialize page visibility
    loginPage.style.display = 'block';
    taskManagerPage.style.display = 'none';

    // Authentication State Observer
    auth.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in
            loginPage.style.display = 'none';
            taskManagerPage.style.display = 'block';
            userEmail.textContent = user.email;
            loadTasks(user.uid);
        } else {
            // User is signed out
            loginPage.style.display = 'block';
            taskManagerPage.style.display = 'none';
            tasks = [];
            renderTasks();
        }
    });

    // Google Sign In
    googleLoginBtn.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .catch((error) => {
                alert('Error signing in: ' + error.message);
            });
    });

    // Logout
    logoutBtn.addEventListener('click', () => {
        auth.signOut()
            .catch((error) => {
                alert('Error signing out: ' + error.message);
            });
    });

    // Load tasks from Firestore
    function loadTasks(userId) {
        if (!userId) return;

        db.collection('tasks')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .onSnapshot(
                (snapshot) => {
                    tasks = [];
                    snapshot.forEach((doc) => {
                        tasks.push({
                            id: doc.id,
                            ...doc.data()
                        });
                    });
                    renderTasks();
                },
                (error) => {
                    alert('Error loading tasks: ' + error.message);
                }
            );
    }

    // Save task to Firestore
    function saveTask(task) {
        const userId = auth.currentUser.uid;
        return db.collection('tasks').add({
            ...task,
            userId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    // Delete task from Firestore
    function deleteTask(taskId) {
        return db.collection('tasks').doc(taskId).delete();
    }

    // Update task in Firestore
    function updateTask(taskId, updates) {
        return db.collection('tasks').doc(taskId).update(updates);
    }

    // Create Task Modal
    createTaskBtn.addEventListener('click', () => {
        createTaskModal.classList.add('is-active');
        taskInput.focus();
    });

    function closeCreateTaskModal() {
        createTaskModal.classList.remove('is-active');
        taskInput.value = '';
        dueDate.value = '';
        dueTime.value = '';
        tagSelect.value = 'remember';
    }

    createTaskModalClose.addEventListener('click', closeCreateTaskModal);
    createTaskModalBackground.addEventListener('click', closeCreateTaskModal);
    cancelCreateTaskBtn.addEventListener('click', closeCreateTaskModal);

    addTaskBtn.addEventListener('click', () => {
        const taskText = taskInput.value.trim();
        if (taskText) {
            const task = {
                text: taskText,
                dueDate: dueDate.value,
                dueTime: dueTime.value,
                tag: tagSelect.value,
                completed: false
            };
            
            saveTask(task)
                .then(() => {
                    closeCreateTaskModal();
                })
                .catch((error) => {
                    alert('Error adding task: ' + error.message);
                });
        }
    });

    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTaskBtn.click();
        }
    });

    dateFilter.addEventListener('change', () => {
        currentDateFilter = dateFilter.value;
        renderTasks();
    });

    tagFilter.addEventListener('change', () => {
        currentTagFilter = tagFilter.value;
        renderTasks();
    });

    statusFilter.addEventListener('change', () => {
        currentStatusFilter = statusFilter.value;
        renderTasks();
    });

    clearFiltersBtn.addEventListener('click', () => {
        dateFilter.value = 'all';
        tagFilter.value = 'all';
        statusFilter.value = 'all';
        currentDateFilter = 'all';
        currentTagFilter = 'all';
        currentStatusFilter = 'all';
        renderTasks();
    });

    function closeModal() {
        deleteModal.classList.remove('is-active');
        taskToDelete = null;
    }

    modalClose.addEventListener('click', closeModal);
    modalBackground.addEventListener('click', closeModal);
    cancelDeleteBtn.addEventListener('click', closeModal);

    confirmDeleteBtn.addEventListener('click', () => {
        if (taskToDelete) {
            deleteTask(taskToDelete)
                .then(() => {
                    closeModal();
                })
                .catch((error) => {
                    alert('Error deleting task: ' + error.message);
                });
        }
    });

    function isTaskExpired(task) {
        if (!task.dueDate) return false;
        const now = new Date();
        const taskDate = new Date(task.dueDate);
        if (task.dueTime) {
            const [hours, minutes] = task.dueTime.split(':');
            taskDate.setHours(parseInt(hours), parseInt(minutes));
        }
        return taskDate < now && !task.completed;
    }

    function isTaskInDateRange(task, dateFilter) {
        if (dateFilter === 'all') return true;
        
        const now = new Date();
        const taskDate = new Date(task.dueDate);
        
        switch (dateFilter) {
            case 'today':
                return taskDate.toDateString() === now.toDateString();
            case 'tomorrow':
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                return taskDate.toDateString() === tomorrow.toDateString();
            case 'week':
                const weekStart = new Date(now);
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                return taskDate >= weekStart && taskDate <= weekEnd;
            case 'month':
                return taskDate.getMonth() === now.getMonth() && 
                       taskDate.getFullYear() === now.getFullYear();
            case 'overdue':
                return isTaskExpired(task);
            default:
                return true;
        }
    }

    function formatDateTime(dateString, timeString) {
        if (!dateString) return '';
        
        const [year, month, day] = dateString.split('-');
        const date = new Date(year, month - 1, day);
        
        let formattedDate = date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
        
        if (timeString) {
            const [hours, minutes] = timeString.split(':');
            const time = new Date();
            time.setHours(parseInt(hours));
            time.setMinutes(parseInt(minutes));
            formattedDate += ` at ${time.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            })}`;
        }
        
        return formattedDate;
    }

    function renderTasks() {
        taskList.innerHTML = '';
        const filteredTasks = tasks.filter(task => {
            if (currentStatusFilter === 'active' && task.completed) return false;
            if (currentStatusFilter === 'completed' && !task.completed) return false;
            if (currentStatusFilter === 'expired' && 
                (!isTaskExpired(task) || task.completed)) return false;

            if (!isTaskInDateRange(task, currentDateFilter)) return false;

            if (currentTagFilter !== 'all' && task.tag !== currentTagFilter) return false;
            
            return true;
        });

        filteredTasks.forEach(task => {
            const isExpired = !task.completed && isTaskExpired(task);
            const taskItem = document.createElement('div');
            taskItem.className = `task-item ${task.completed ? 'completed' : ''} ${isExpired ? 'expired' : ''}`;
            taskItem.innerHTML = `
                <label class="checkbox task-checkbox">
                    <input type="checkbox" ${task.completed ? 'checked' : ''}>
                </label>
                <span class="task-text">${task.text}</span>
                <span class="task-due-date">${formatDateTime(task.dueDate, task.dueTime)}</span>
                <span class="task-tag tag-${task.tag}">${task.tag}</span>
                <button class="delete is-small delete-btn"></button>
            `;

            const checkbox = taskItem.querySelector('input[type="checkbox"]');
            const deleteBtn = taskItem.querySelector('.delete-btn');

            checkbox.addEventListener('change', () => {
                updateTask(task.id, { completed: checkbox.checked })
                    .catch((error) => {
                        alert('Error updating task: ' + error.message);
                    });
            });

            deleteBtn.addEventListener('click', () => {
                taskToDelete = task.id;
                deleteModal.classList.add('is-active');
            });

            taskList.appendChild(taskItem);
        });
    }
}); 