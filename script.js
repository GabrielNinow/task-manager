document.addEventListener('DOMContentLoaded', () => {
    const loginPage = document.getElementById('loginPage');
    const taskManagerPage = document.getElementById('taskManagerPage');
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userEmail = document.getElementById('userEmail');
    const createTaskBtn = document.getElementById('createTaskBtn');
    const alarmSound = document.getElementById('alarmSound');
    const debugAlarmBtn = document.getElementById('debugAlarmBtn');
    
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

    const audioPermissionBox = document.getElementById('audioPermissionBox');
    const enableAudioBtn = document.getElementById('enableAudioBtn');
    let audioPermissionGranted = false;

    let tasks = [];
    let currentDateFilter = 'all';
    let currentTagFilter = 'all';
    let currentStatusFilter = 'all';
    let taskToDelete = null;
    let alarmInterval = null;
    let notifiedTasks = new Set();

    loginPage.style.display = 'block';
    taskManagerPage.style.display = 'none';

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            loginPage.style.display = 'none';
            taskManagerPage.style.display = 'block';
            userEmail.textContent = user.email;
            loadTasks(user.uid);
            
            const hasPermission = await checkAudioPermission();
            if (!hasPermission) {
                audioPermissionBox.style.display = 'block';
            }
        } else {
            loginPage.style.display = 'block';
            taskManagerPage.style.display = 'none';
            tasks = [];
            renderTasks();
            audioPermissionBox.style.display = 'none';
        }
    });

    googleLoginBtn.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .catch((error) => {
                alert('Error signing in: ' + error.message);
            });
    });

    logoutBtn.addEventListener('click', () => {
        if (alarmInterval) {
            clearInterval(alarmInterval);
        }
        notifiedTasks.clear();
        auth.signOut()
            .catch((error) => {
                alert('Error signing out: ' + error.message);
            });
    });

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
                    startAlarmCheck();
                },
                (error) => {
                    alert('Error loading tasks: ' + error.message);
                }
            );
    }

    function saveTask(task) {
        const userId = auth.currentUser.uid;
        return db.collection('tasks').add({
            ...task,
            userId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    function deleteTask(taskId) {
        return db.collection('tasks').doc(taskId).delete();
    }

    function updateTask(taskId, updates) {
        return db.collection('tasks').doc(taskId).update(updates);
    }

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
            const dueDate = document.getElementById('dueDate').value;
            const dueTime = document.getElementById('dueTime').value;
            
            const task = {
                text: taskText,
                dueDate: dueDate,
                dueTime: dueTime,
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
        const taskDate = new Date(task.dueDate + 'T00:00:00');

        if (taskDate > now) {
            return false;
        }

        if (taskDate.toDateString() === now.toDateString() && task.dueTime) {
            const [hours, minutes] = task.dueTime.split(':');
            const taskDateTime = new Date(taskDate);
            taskDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            
            return taskDateTime < now && !task.completed;
        }

        console.log('Task is in the past, expired');
        return !task.completed;
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

    function startAlarmCheck() {
        if (alarmInterval) {
            clearInterval(alarmInterval);
        }
        
        alarmInterval = setInterval(checkUpcomingTasks, 10000); 
    }

    function checkUpcomingTasks() {
        const now = new Date();
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60000);

        tasks.forEach(task => {
            if (task.completed || !task.dueDate || !task.dueTime || notifiedTasks.has(task.id)) {
                return;
            }

            const taskDateTime = new Date(task.dueDate + 'T' + task.dueTime);
            
            if (taskDateTime <= fiveMinutesFromNow && taskDateTime > now) {
                playAlarm(task);
            }
        });
    }

    async function checkAudioPermission() {
        try {
            const audio = new Audio();
            audio.volume = 0;
            await audio.play();
            audio.pause();
            audioPermissionGranted = true;
            audioPermissionBox.style.display = 'none';
            return true;
        } catch (error) {
            return false;
        }
    }

    enableAudioBtn.addEventListener('click', async () => {
        try {
            const audio = new Audio();
            audio.volume = 0;
            await audio.play();
            audio.pause();
            audioPermissionGranted = true;
            audioPermissionBox.style.display = 'none';
        } catch (error) {
            alert('Please allow audio permissions in your browser settings to enable task alarms.');
        }
    });

    document.addEventListener('DOMContentLoaded', async () => {
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    });

    function playAlarm(task) {
        const taskDateTime = new Date(task.dueDate + 'T' + task.dueTime);
        const now = new Date();
        const timeUntilDue = Math.ceil((taskDateTime - now) / 60000);
        
        let timeMessage;
        if (timeUntilDue === 0) {
            timeMessage = 'is due now!';
        } else if (timeUntilDue === 1) {
            timeMessage = 'is due in 1 minute!';
        } else {
            timeMessage = `is due in ${timeUntilDue} minutes!`;
        }

        alarmSound.currentTime = 0;
        
        const playPromise = alarmSound.play();
        
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    alert(`Task Due Soon!\n\n"${task.text}" ${timeMessage}\n\nDue at: ${task.dueTime}`);
                })
                .catch(error => {
                    if (error.name === 'NotAllowedError') {
                        audioPermissionBox.style.display = 'block';
                    }
                });
        }

        if (Notification.permission === "granted") {
            new Notification("Task Due Soon", {
                body: `"${task.text}" ${timeMessage}\nDue at: ${task.dueTime}`,
                icon: "https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css"
            });
        }

        notifiedTasks.add(task.id);
    }
}); 