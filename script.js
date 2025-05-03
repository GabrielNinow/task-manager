document.addEventListener('DOMContentLoaded', () => {
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
    
    const deleteModal = document.getElementById('deleteModal');
    const cancelDeleteBtn = document.getElementById('cancelDelete');
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    const modalClose = deleteModal.querySelector('.modal-close');
    const modalBackground = deleteModal.querySelector('.modal-background');

    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let currentDateFilter = 'all';
    let currentTagFilter = 'all';
    let currentStatusFilter = 'all';
    let taskToDelete = null;

    renderTasks();

    addTaskBtn.addEventListener('click', addTask);
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTask();
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
            tasks = tasks.filter(t => t.id !== taskToDelete);
            saveTasks();
            renderTasks();
            closeModal();
        }
    });

    function addTask() {
        const taskText = taskInput.value.trim();
        if (taskText) {
            const task = {
                id: Date.now(),
                text: taskText,
                dueDate: dueDate.value,
                dueTime: dueTime.value,
                tag: tagSelect.value,
                completed: false
            };
            tasks.push(task);
            saveTasks();
            taskInput.value = '';
            dueDate.value = '';
            dueTime.value = '';
            renderTasks();
        }
    }

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
        
        // Parse the date string and create a date object in local timezone
        const [year, month, day] = dateString.split('-');
        const date = new Date(year, month - 1, day);
        
        // Format the date in local timezone
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
                task.completed = checkbox.checked;
                taskItem.classList.toggle('completed', task.completed);
                taskItem.classList.toggle('expired', !task.completed && isTaskExpired(task));
                saveTasks();
            });

            deleteBtn.addEventListener('click', () => {
                taskToDelete = task.id;
                deleteModal.classList.add('is-active');
            });

            taskList.appendChild(taskItem);
        });
    }

    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }
}); 