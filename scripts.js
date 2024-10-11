// Global Variables
let currentTime = 0;
let intervalId;
let simulationSpeed = 1000; // Time unit in milliseconds
let isSimulationRunning = false;
let processes = []; // Global processes array
let simulationEndTime = 0;
let simulationStates = []; // For backward stepping
let currentProcessId = null; // To keep track of the process in CPU
let algorithm; // Selected algorithm
let schedule = []; // Global schedule
let timeQuantum = null; // For Round Robin
let simulationId = null; // For saving simulations

// Wait for the DOM to load
document.addEventListener('DOMContentLoaded', () => {
    initialize();
});

function initialize() {
    // Event Listeners
    document.getElementById('algorithm').addEventListener('change', algorithmChanged);
    document.getElementById('add-process').addEventListener('click', addProcessRow);
    document.getElementById('run').addEventListener('click', runSimulation);
    document.getElementById('reset').addEventListener('click', resetSimulation);
    document.getElementById('pause').addEventListener('click', pauseSimulation);
    document.getElementById('resume').addEventListener('click', resumeSimulation);
    document.getElementById('step-forward').addEventListener('click', stepForward);
    document.getElementById('step-backward').addEventListener('click', stepBackward);

    // Initial setup
    algorithmChanged(); // Set up the page based on the default selected algorithm
    addProcessRow(); // Add the first process row
}

function algorithmChanged() {
    const prevAlgorithm = algorithm;
    algorithm = document.getElementById('algorithm').value;

    // Reset the simulation if the algorithm has changed
    if (prevAlgorithm && prevAlgorithm !== algorithm) {
        resetSimulation();
    }

    const priorityHeaders = document.querySelectorAll('.priority-header');
    const priorityCells = document.querySelectorAll('.priority-cell');
    const timeQuantumSection = document.getElementById('time-quantum-section');

    // Show or hide Priority column
    if (algorithm.includes('Priority')) {
        priorityHeaders.forEach(header => header.style.display = '');
        priorityCells.forEach(cell => cell.style.display = '');
    } else {
        priorityHeaders.forEach(header => header.style.display = 'none');
        priorityCells.forEach(cell => cell.style.display = 'none');
    }

    // Show or hide Time Quantum input
    if (algorithm === 'RR') {
        timeQuantumSection.classList.remove('d-none');
    } else {
        timeQuantumSection.classList.add('d-none');
    }
}

function pauseSimulation() {
    if (isSimulationRunning) {
        clearInterval(intervalId);
        isSimulationRunning = false;
    }
}

function resumeSimulation() {
    if (!isSimulationRunning && currentTime <= simulationEndTime) {
        isSimulationRunning = true;
        intervalId = setInterval(simulateTimeUnit, simulationSpeed);
    }
}

function addProcessRow() {
    const tbody = document.querySelector('#process-table tbody');
    const row = document.createElement('tr');

    // Generate the next available process ID
    const existingIds = Array.from(tbody.querySelectorAll('.process-id'))
        .map(input => parseInt(input.value));
    let newId = 1;
    while (existingIds.includes(newId)) {
        newId++;
    }

    row.innerHTML = `
        <td><input type="text" class="process-id form-control" value="${newId}" readonly></td>
        <td><input type="number" class="arrival-time form-control" min="0" required></td>
        <td><input type="number" class="burst-time form-control" min="1" required></td>
        <td class="priority-cell"><input type="number" class="priority form-control" min="1"></td>
        <td><button class="remove-process btn btn-danger btn-sm">Remove</button></td>
    `;

    // Hide Priority cell if not applicable
    if (!algorithm.includes('Priority')) {
        row.querySelector('.priority-cell').style.display = 'none';
    }

    // Add event listener to the Remove button
    row.querySelector('.remove-process').addEventListener('click', () => {
        row.remove();
        reassignProcessIds();  // Reassign IDs after row removal
    });

    // Append the row to the table
    tbody.appendChild(row);
}

// Function to reassign process IDs after row removal
function reassignProcessIds() {
    const rows = document.querySelectorAll('#process-table tbody tr');
    let newId = 1;
    rows.forEach(row => {
        const processIdField = row.querySelector('.process-id');
        processIdField.value = newId++; // Assign new sequential ID
    });
}

function gatherProcesses() {
    const rows = document.querySelectorAll('#process-table tbody tr');
    processes = []; // Reset processes array
    const ids = new Set(); // To check for duplicate IDs

    for (const row of rows) {
        const id = row.querySelector('.process-id').value.trim();
        const arrivalTimeInput = row.querySelector('.arrival-time');
        const burstTimeInput = row.querySelector('.burst-time');
        const priorityInput = row.querySelector('.priority');

        // Validate inputs
        if (!id) {
            alert('Please enter a valid Process ID.');
            return null;
        }
        if (ids.has(id)) {
            alert(`Duplicate Process ID detected: ${id}. Please use unique IDs.`);
            return null;
        }
        ids.add(id);

        const arrivalTime = parseInt(arrivalTimeInput.value);
        const burstTime = parseInt(burstTimeInput.value);
        let priority = 0;

        if (priorityInput && !priorityInput.closest('.priority-cell').style.display.includes('none')) {
            priority = parseInt(priorityInput.value) || 0;
            if (isNaN(priority) || priority <= 0) {
                alert('Please enter a valid Priority (positive integer).');
                return null;
            }
        }

        if (isNaN(arrivalTime) || arrivalTime < 0) {
            alert('Please enter a valid Arrival Time (>=0).');
            return null;
        }
        if (isNaN(burstTime) || burstTime <= 0) {
            alert('Please enter a valid Burst Time (>0).');
            return null;
        }

        processes.push(new Process(id, arrivalTime, burstTime, priority));
    }

    return processes;
}

function runSimulation() {
    if (isSimulationRunning) return; // Prevent multiple simulations at once

    processes = gatherProcesses(); // Now sets the global 'processes' variable

    if (!processes || processes.length === 0) {
        alert('Please add at least one process with valid inputs.');
        return;
    }

    // If Round Robin, get the time quantum
    if (algorithm === 'RR') {
        timeQuantum = parseInt(document.getElementById('time-quantum').value);
        if (isNaN(timeQuantum) || timeQuantum <= 0 || timeQuantum > Number.MAX_SAFE_INTEGER) {
            alert('Please enter a valid Time Quantum.');
            return;
        }
    } else {
        timeQuantum = null;
    }

    // Generate a unique simulation ID using timestamp
    simulationId = `SIM-${Date.now()}`;

    let result;
    switch (algorithm) {
        case 'FCFS':
            result = fcfs(cloneProcesses(processes));
            break;
        case 'SJF_NP':
            result = sjfNonPreemptive(cloneProcesses(processes));
            break;
        case 'SJF_P':
            result = sjfPreemptive(cloneProcesses(processes));
            break;
        case 'RR':
            result = roundRobin(cloneProcesses(processes), timeQuantum);
            break;
        case 'Priority_NP':
            result = priorityNonPreemptive(cloneProcesses(processes));
            break;
        case 'Priority_P':
            result = priorityPreemptive(cloneProcesses(processes));
            break;
        default:
            alert('Please select a valid scheduling algorithm.');
            return;
    }

    // Store the schedule globally
    schedule = result.schedule;

    simulationEndTime = schedule[schedule.length - 1].endTime;

    // Display results
    displayResults(result);

    // Initialize visualization
    resetVisualization();
    initializeProcesses(processes);
    startSimulation();

    // Save simulation details (prepare for database integration)
    saveSimulation(result);
}

function stepForward() {
    if (currentTime <= simulationEndTime) {
        simulateTimeUnit();
    }
}

function resetVisualization() {
    currentTime = 0;
    isSimulationRunning = false;
    clearInterval(intervalId);
    document.getElementById('current-time').textContent = currentTime;
    document.getElementById('queue-container').innerHTML = '';
    document.getElementById('cpu-container').innerHTML = '';
    document.getElementById('completed-container').innerHTML = '';
    currentProcessId = null;
    simulationStates = []; // Reset simulation states
}

function initializeProcesses(processes) {
    processes.forEach(process => {
        // Create process element
        const processEl = document.createElement('div');
        processEl.classList.add('process');
        processEl.id = `process-${process.id}`;
        processEl.innerHTML = `
            <div>${process.id}</div>
            <div class="remaining-time">RT: ${formatNumber(process.remainingTime)}</div>
        `;
        processEl.dataset.arrivalTime = process.arrivalTime;
        processEl.dataset.burstTime = process.burstTime;
        processEl.dataset.priority = process.priority;

        // Hide initially
        processEl.style.display = 'none';

        // Append to body (or a hidden container) to manage later
        document.body.appendChild(processEl);
    });
}

function startSimulation() {
    isSimulationRunning = true;
    intervalId = setInterval(simulateTimeUnit, simulationSpeed);
}

function simulateTimeUnit() {
    document.getElementById('current-time').textContent = currentTime;

    // Save current state for backward stepping
    saveCurrentState();

    // Check for arriving processes
    const allProcesses = document.querySelectorAll('.process');
    allProcesses.forEach(processEl => {
        const arrivalTime = parseInt(processEl.dataset.arrivalTime);
        if (arrivalTime === currentTime && processEl.parentElement.id !== 'queue-container') {
            // Process arrives
            processEl.style.display = '';
            insertProcessIntoReadyQueue(processEl);
        }
    });

    // Determine which process should be running at currentTime
    const scheduleEntry = schedule.find(
        entry => entry.startTime === currentTime
    );

    if (scheduleEntry) {
        // If the process in the CPU is not the scheduled process, switch
        if (currentProcessId !== scheduleEntry.processId) {
            if (currentProcessId !== null) {
                // Move current process out of CPU
                const currentProcess = processes.find(p => p.id === currentProcessId);
                if (currentProcess.remainingTime === 0) {
                    // Process has completed execution
                    moveToCompleted(currentProcessId);
                } else {
                    // Process was preempted, move back to ready queue
                    moveToReadyQueue(currentProcessId);
                }
            }
            // Move scheduled process into CPU
            moveToCPU(scheduleEntry.processId);
            currentProcessId = scheduleEntry.processId;
        }
    } else {
        // No process is scheduled to run at this time
        if (currentProcessId !== null) {
            const currentProcess = processes.find(p => p.id === currentProcessId);
            if (currentProcess.remainingTime === 0) {
                moveToCompleted(currentProcessId);
            } else {
                // Process continues running
                // No action needed
            }
        }
    }

    // Decrement remaining time of the current process
    if (currentProcessId !== null) {
        const currentProcess = processes.find(p => p.id === currentProcessId);
        currentProcess.remainingTime--;
        if (currentProcess.remainingTime === 0) {
            // Process has completed execution
            currentProcess.completionTime = currentTime + 1;
            moveToCompleted(currentProcessId);
            currentProcessId = null;
        }
    }

    // Update remaining time labels
    processes.forEach(process => {
        const processEl = document.getElementById(`process-${process.id}`);
        if (processEl) {
            const remainingTimeEl = processEl.querySelector('.remaining-time');
            if (remainingTimeEl) {
                remainingTimeEl.textContent = `RT: ${formatNumber(process.remainingTime)}`;
            }
        }
    });

    // Wait for animations to complete before moving to the next time unit
    setTimeout(() => {
        currentTime++;

        // Check if simulation is over
        if (currentTime > simulationEndTime) {
            clearInterval(intervalId);
            isSimulationRunning = false;
            // Update completion times for any processes that finished at the last time unit
            processes.forEach(process => {
                if (process.remainingTime === 0 && !process.completionTime) {
                    process.completionTime = currentTime;
                }
            });
            // Save the final state
            saveCurrentState();
        }
    }, simulationSpeed / 2);
}



function saveCurrentState() {
    const state = {
        currentTime: currentTime,
        processes: JSON.parse(JSON.stringify(processes)),
        queueHTML: document.getElementById('queue-container').innerHTML,
        cpuHTML: document.getElementById('cpu-container').innerHTML,
        completedHTML: document.getElementById('completed-container').innerHTML,
        currentProcessId: currentProcessId,
    };
    simulationStates[currentTime] = state;
}

function saveCurrentState() {
    // Deep clone the necessary elements
    const state = {
        currentTime: currentTime,
        processes: JSON.parse(JSON.stringify(processes)),
        queueHTML: document.getElementById('queue-container').innerHTML,
        cpuHTML: document.getElementById('cpu-container').innerHTML,
        completedHTML: document.getElementById('completed-container').innerHTML,
        currentProcessId: currentProcessId,
    };
    simulationStates.push(state);
}

function stepBackward() {
    if (currentTime > 0) {
        currentTime--;

        const prevState = simulationStates[currentTime];

        if (prevState) {
            document.getElementById('current-time').textContent = prevState.currentTime;
            processes = JSON.parse(JSON.stringify(prevState.processes));
            currentProcessId = prevState.currentProcessId;

            // Restore the HTML content of the containers
            document.getElementById('queue-container').innerHTML = prevState.queueHTML;
            document.getElementById('cpu-container').innerHTML = prevState.cpuHTML;
            document.getElementById('completed-container').innerHTML = prevState.completedHTML;

            // Update process elements to match the restored state
            updateProcessElements();
        }
    }
}
function updateProcessElements() {
    processes.forEach(process => {
        const processEl = document.getElementById(`process-${process.id}`);
        if (processEl) {
            const remainingTimeEl = processEl.querySelector('.remaining-time');
            if (remainingTimeEl) {
                remainingTimeEl.textContent = `RT: ${formatNumber(process.remainingTime)}`;
            }
            processEl.dataset.arrivalTime = process.arrivalTime;
            processEl.dataset.burstTime = process.burstTime;
            processEl.dataset.priority = process.priority;
        }
    });
}



function formatNumber(number) {
    if (number >= 1e6) {
        return (number / 1e6).toFixed(1) + 'M';
    } else if (number >= 1e3) {
        return (number / 1e3).toFixed(1) + 'k';
    } else {
        return number;
    }
}

function moveToReadyQueue(processId) {
    const processEl = document.getElementById(`process-${processId}`);
    if (processEl) {
        // Remove existing animation classes
        processEl.classList.remove('move-to-cpu', 'move-to-completed', 'move-from-cpu');
        processEl.classList.add('move-to-ready');
        setTimeout(() => {
            processEl.classList.remove('move-to-ready');
            insertProcessIntoReadyQueue(processEl);
        }, simulationSpeed / 2);
    }
    // Do not reset currentProcessId here
    // It is managed in simulateTimeUnit()
}

function moveToCPU(processId) {
    const processEl = document.getElementById(`process-${processId}`);
    const cpuContainer = document.getElementById('cpu-container');

    if (processEl) {
        // Remove existing animation classes
        processEl.classList.remove('move-to-ready', 'move-to-completed', 'move-from-cpu');

        // Remove any existing process from the CPU container
        while (cpuContainer.firstChild) {
            const existingProcessEl = cpuContainer.firstChild;
            existingProcessEl.classList.add('move-from-cpu');
            setTimeout(() => {
                existingProcessEl.classList.remove('move-from-cpu');
                // Move the existing process back to the ready queue
                insertProcessIntoReadyQueue(existingProcessEl);
            }, simulationSpeed / 2);
            cpuContainer.removeChild(existingProcessEl);
        }

        // Move the new process into the CPU
        if (processEl.parentElement.id !== 'cpu-container') {
            processEl.classList.add('move-to-cpu');
            setTimeout(() => {
                processEl.classList.remove('move-to-cpu');
                cpuContainer.appendChild(processEl);
            }, simulationSpeed / 2);
        }
    }
    // Do not set currentProcessId here
    // It is managed in simulateTimeUnit()
}


function moveToCompleted(processId) {
    const processEl = document.getElementById(`process-${processId}`);
    if (processEl) {
        // Remove existing animation classes
        processEl.classList.remove('move-to-ready', 'move-to-cpu', 'move-from-cpu');
        processEl.classList.add('move-to-completed');
        setTimeout(() => {
            processEl.classList.remove('move-to-completed');
            document.getElementById('completed-container').appendChild(processEl);
        }, simulationSpeed / 2);
    }
    // Do not set currentProcessId here
    // It is managed in simulateTimeUnit()
}


function insertProcessIntoReadyQueue(processEl) {
    const queueContainer = document.getElementById('queue-container');
    const processId = processEl.id.replace('process-', '');
    const process = processes.find(p => p.id === processId);

    // Remove from queue if already present
    if (processEl.parentElement === queueContainer) {
        queueContainer.removeChild(processEl);
    }

    // Get the processes in the queue
    const queueProcesses = Array.from(queueContainer.children).map(el => {
        const id = el.id.replace('process-', '');
        return processes.find(p => p.id === id);
    });

    // Insert the process based on the algorithm
    let inserted = false;
    for (let i = 0; i < queueProcesses.length; i++) {
        if (compareProcesses(process, queueProcesses[i]) < 0) {
            queueContainer.insertBefore(processEl, queueContainer.children[i]);
            inserted = true;
            break;
        }
    }
    if (!inserted) {
        queueContainer.appendChild(processEl);
    }
}

function compareProcesses(p1, p2) {
    switch (algorithm) {
        case 'FCFS':
            return p1.arrivalTime - p2.arrivalTime;
        case 'SJF_NP':
        case 'SJF_P':
            return p1.remainingTime - p2.remainingTime;
        case 'Priority_NP':
        case 'Priority_P':
            return p1.priority - p2.priority;
        case 'RR':
            return 0; // Round Robin doesn't reorder the queue
        default:
            return 0;
    }
}

function moveToCPU(processId) {
    const processEl = document.getElementById(`process-${processId}`);
    const cpuContainer = document.getElementById('cpu-container');

    if (processEl) {
        // Remove any existing process from the CPU container
        while (cpuContainer.firstChild) {
            const existingProcessEl = cpuContainer.firstChild;
            existingProcessEl.classList.add('move-from-cpu');
            setTimeout(() => {
                existingProcessEl.classList.remove('move-from-cpu');
                // Move the existing process back to the ready queue
                insertProcessIntoReadyQueue(existingProcessEl);
            }, simulationSpeed / 2);
            cpuContainer.removeChild(existingProcessEl);
        }

        // Move the new process into the CPU
        if (processEl.parentElement.id !== 'cpu-container') {
            processEl.classList.add('move-to-cpu');
            setTimeout(() => {
                processEl.classList.remove('move-to-cpu');
                cpuContainer.appendChild(processEl);
            }, simulationSpeed / 2);
        }
    }
    currentProcessId = processId;
}


function moveToCompleted(processId) {
    const processEl = document.getElementById(`process-${processId}`);
    if (processEl) {
        processEl.classList.add('move-to-completed');
        setTimeout(() => {
            processEl.classList.remove('move-to-completed');
            document.getElementById('completed-container').appendChild(processEl);
        }, simulationSpeed / 2);
    }
    if (currentProcessId === processId) {
        currentProcessId = null;
    }
}

function displayResults({ processes, schedule, metrics }) {
    // Display Gantt Chart
    displayGanttChart(schedule);

    // Display Metrics
    const tbody = document.querySelector('#metrics-table tbody');
    tbody.innerHTML = '';
    let totalWaitingTime = 0;
    let totalTurnaroundTime = 0;

    processes.forEach(process => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${process.id}</td>
            <td>${process.waitingTime}</td>
            <td>${process.turnaroundTime}</td>
        `;
        tbody.appendChild(row);
        totalWaitingTime += process.waitingTime;
        totalTurnaroundTime += process.turnaroundTime;
    });

    const avgWaitingTime = (totalWaitingTime / processes.length).toFixed(2);
    const avgTurnaroundTime = (totalTurnaroundTime / processes.length).toFixed(2);

    document.getElementById('average-waiting-time').textContent = `Average Waiting Time: ${avgWaitingTime}`;
    document.getElementById('average-turnaround-time').textContent = `Average Turnaround Time: ${avgTurnaroundTime}`;
}

function displayGanttChart(schedule) {
    const ganttChart = document.getElementById('gantt-chart');
    ganttChart.innerHTML = ''; // Clear previous chart

    if (schedule.length === 0) {
        ganttChart.textContent = 'No schedule to display.';
        return;
    }

    // Calculate total time
    const totalTime = schedule[schedule.length - 1].endTime;

    // Generate Gantt bars
    schedule.forEach(entry => {
        const bar = document.createElement('div');
        bar.classList.add('gantt-bar');
        bar.style.left = `${(entry.startTime / totalTime) * 100}%`;
        bar.style.width = `${((entry.endTime - entry.startTime) / totalTime) * 100}%`;
        bar.textContent = entry.processId;
        ganttChart.appendChild(bar);
    });
}

function resetSimulation() {
    if (isSimulationRunning) {
        clearInterval(intervalId);
        isSimulationRunning = false;
    }
    currentTime = 0;
    currentProcessId = null;
    processes = [];
    schedule = [];
    simulationStates = [];
    simulationEndTime = 0;
    algorithm = document.getElementById('algorithm').value;

    // Reset inputs
    const tbody = document.querySelector('#process-table tbody');
    tbody.innerHTML = '';
    addProcessRow();

    // Clear outputs
    document.getElementById('gantt-chart').innerHTML = '';
    document.querySelector('#metrics-table tbody').innerHTML = '';
    document.getElementById('average-waiting-time').textContent = '';
    document.getElementById('average-turnaround-time').textContent = '';

    // Reset visualization
    resetVisualization();
}

function Process(id, arrivalTime, burstTime, priority = 0) {
    this.id = id;
    this.arrivalTime = arrivalTime;
    this.burstTime = burstTime;
    this.priority = priority;
    this.remainingTime = burstTime; // For preemptive algorithms
    this.completionTime = 0;
    this.waitingTime = 0;
    this.turnaroundTime = 0;
    this.startTime = null;
}

function cloneProcesses(processes) {
    return processes.map(p => new Process(p.id, p.arrivalTime, p.burstTime, p.priority));
}

function calculateMetrics(processes) {
    let totalWaitingTime = 0;
    let totalTurnaroundTime = 0;
    let totalBurstTime = 0;
    let totalTime = 0;

    processes.forEach(process => {
        totalWaitingTime += process.waitingTime;
        totalTurnaroundTime += process.turnaroundTime;
        totalBurstTime += process.burstTime;
        if (process.completionTime > totalTime) {
            totalTime = process.completionTime;
        }
    });

    const averageWaitingTime = (totalWaitingTime / processes.length).toFixed(2);
    const averageTurnaroundTime = (totalTurnaroundTime / processes.length).toFixed(2);
    const cpuUtilization = ((totalBurstTime / totalTime) * 100).toFixed(2);

    return {
        averageWaitingTime,
        averageTurnaroundTime,
        cpuUtilization,
    };
}





function saveSimulation(result) {
    // Prepare simulation data
    const simulationData = {
        simulationId: simulationId,
        algorithm: algorithm,
        processes: processes.map(p => ({
            id: p.id,
            arrivalTime: p.arrivalTime,
            burstTime: p.burstTime,
            priority: p.priority,
        })),
        schedule: result.schedule,
        metrics: result.metrics,
        timestamp: new Date().toISOString(),
    };

    // For now, we'll save it to localStorage (you can replace this with your database integration)
    let simulations = JSON.parse(localStorage.getItem('simulations')) || [];
    simulations.push(simulationData);
    localStorage.setItem('simulations', JSON.stringify(simulations));

    // Notify the user
    console.log(`Simulation ${simulationId} saved.`);
}




function fcfs(processes) {
    // Sort processes by arrival time
    processes.sort((a, b) => a.arrivalTime - b.arrivalTime);
    let currentTime = 0;
    let schedule = [];

    for (let process of processes) {
        if (currentTime < process.arrivalTime) {
            currentTime = process.arrivalTime;
        }
        process.startTime = currentTime;
        process.completionTime = currentTime + process.burstTime;
        process.waitingTime = currentTime - process.arrivalTime;
        process.turnaroundTime = process.completionTime - process.arrivalTime;
        currentTime += process.burstTime;

        // Record the schedule
        schedule.push({
            processId: process.id,
            startTime: process.startTime,
            endTime: process.completionTime,
        });
    }

    const metrics = calculateMetrics(processes);
    return { processes, schedule, metrics };
}



function sjfNonPreemptive(processes) {
    let currentTime = 0;
    let completed = 0;
    const n = processes.length;
    let schedule = [];
    let isVisited = new Array(n).fill(false);

    while (completed !== n) {
        let idx = -1;
        let minBurstTime = Infinity;

        for (let i = 0; i < n; i++) {
            if (
                processes[i].arrivalTime <= currentTime &&
                !isVisited[i] &&
                processes[i].burstTime < minBurstTime
            ) {
                minBurstTime = processes[i].burstTime;
                idx = i;
            }
        }

        if (idx !== -1) {
            let process = processes[idx];
            process.startTime = currentTime;
            process.waitingTime = currentTime - process.arrivalTime;
            process.completionTime = currentTime + process.burstTime;
            process.turnaroundTime = process.completionTime - process.arrivalTime;
            currentTime += process.burstTime;
            isVisited[idx] = true;
            completed++;

            // Record the schedule
            schedule.push({
                processId: process.id,
                startTime: process.startTime,
                endTime: process.completionTime,
            });
        } else {
            currentTime++;
        }
    }

    const metrics = calculateMetrics(processes);
    return { processes, schedule, metrics };
}

function sjfPreemptive(processes) {
    let n = processes.length;
    let currentTime = 0;
    let completed = 0;
    let schedule = [];
    let prevProcessId = null;

    // Initialize startTime for each process
    processes.forEach(process => {
        process.startTime = null;
    });

    while (completed !== n) {
        let idx = -1;
        let minRemainingTime = Infinity;

        for (let i = 0; i < n; i++) {
            if (
                processes[i].arrivalTime <= currentTime &&
                processes[i].remainingTime > 0 &&
                processes[i].remainingTime < minRemainingTime
            ) {
                minRemainingTime = processes[i].remainingTime;
                idx = i;
            }
        }

        if (idx !== -1) {
            let process = processes[idx];

            if (process.startTime === null) {
                process.startTime = currentTime;
            }

            // Check for context switch
            if (prevProcessId !== process.id) {
                if (prevProcessId !== null) {
                    // End the previous process in the schedule
                    schedule[schedule.length - 1].endTime = currentTime;
                }
                // Start a new schedule entry for the current process
                schedule.push({
                    processId: process.id,
                    startTime: currentTime,
                    endTime: null, // Will be updated
                });
                prevProcessId = process.id;
            }

            // Execute process for 1 time unit
            process.remainingTime--;
            currentTime++;

            if (process.remainingTime === 0) {
                // Process has completed execution
                process.completionTime = currentTime;
                process.turnaroundTime = process.completionTime - process.arrivalTime;
                process.waitingTime = process.turnaroundTime - process.burstTime;
                completed++;

                // End the current process's schedule entry
                schedule[schedule.length - 1].endTime = currentTime;
                prevProcessId = null; // No process is currently running
            }
        } else {
            // CPU is idle
            if (prevProcessId !== null) {
                // End the previous process in the schedule
                schedule[schedule.length - 1].endTime = currentTime;
                prevProcessId = null;
            }
            currentTime++;
        }
    }

    // Ensure the last schedule entry is closed
    if (schedule.length > 0 && schedule[schedule.length - 1].endTime === null) {
        schedule[schedule.length - 1].endTime = currentTime;
    }

    const metrics = calculateMetrics(processes);
    return { processes, schedule, metrics };
}




function roundRobin(processes, timeQuantum) {
    let n = processes.length;
    let currentTime = 0;
    let completed = 0;
    let queue = [];
    let schedule = [];
    let prevProcessId = null;

    // Sort processes by arrival time
    processes.sort((a, b) => a.arrivalTime - b.arrivalTime);
    let i = 0;

    while (completed !== n) {
        // Enqueue arrived processes
        while (i < n && processes[i].arrivalTime <= currentTime) {
            queue.push(processes[i]);
            i++;
        }

        if (queue.length === 0) {
            currentTime++;
            continue;
        }

        let process = queue.shift();

        if (process.startTime === null) {
            process.startTime = currentTime;
        }

        // Check for context switch
        if (prevProcessId !== process.id) {
            if (prevProcessId !== null) {
                // End the previous process in the schedule
                schedule[schedule.length - 1].endTime = currentTime;
            }
            // Start a new process in the schedule
            schedule.push({
                processId: process.id,
                startTime: currentTime,
                endTime: null, // Will be updated
            });
            prevProcessId = process.id;
        }

        let execTime = Math.min(timeQuantum, process.remainingTime);
        process.remainingTime -= execTime;
        currentTime += execTime;

        // Enqueue newly arrived processes during execution
        while (i < n && processes[i].arrivalTime <= currentTime) {
            queue.push(processes[i]);
            i++;
        }

        if (process.remainingTime > 0) {
            queue.push(process);
        } else {
            process.completionTime = currentTime;
            process.turnaroundTime = process.completionTime - process.arrivalTime;
            process.waitingTime = process.turnaroundTime - process.burstTime;
            completed++;
        }

        // End the current process's schedule entry if it's completed
        if (process.remainingTime === 0 && schedule[schedule.length - 1].endTime === null) {
            schedule[schedule.length - 1].endTime = currentTime;
            prevProcessId = null;
        }
    }

    // Close the last process in the schedule
    if (schedule.length > 0 && schedule[schedule.length - 1].endTime === null) {
        schedule[schedule.length - 1].endTime = currentTime;
    }

    const metrics = calculateMetrics(processes);
    return { processes, schedule, metrics };
}

function priorityNonPreemptive(processes) {
    let currentTime = 0;
    let completed = 0;
    const n = processes.length;
    let schedule = [];
    let isVisited = new Array(n).fill(false);

    while (completed !== n) {
        let idx = -1;
        let highestPriority = Infinity;

        for (let i = 0; i < n; i++) {
            if (
                processes[i].arrivalTime <= currentTime &&
                !isVisited[i] &&
                processes[i].priority < highestPriority
            ) {
                highestPriority = processes[i].priority;
                idx = i;
            }
        }

        if (idx !== -1) {
            let process = processes[idx];
            process.startTime = currentTime;
            process.waitingTime = currentTime - process.arrivalTime;
            process.completionTime = currentTime + process.burstTime;
            process.turnaroundTime = process.completionTime - process.arrivalTime;
            currentTime += process.burstTime;
            isVisited[idx] = true;
            completed++;

            // Record the schedule
            schedule.push({
                processId: process.id,
                startTime: process.startTime,
                endTime: process.completionTime,
            });
        } else {
            currentTime++;
        }
    }

    const metrics = calculateMetrics(processes);
    return { processes, schedule, metrics };
}

function priorityPreemptive(processes) {
    let n = processes.length;
    let currentTime = 0;
    let completed = 0;
    let schedule = [];
    let prevProcessId = null;

    // Initialize startTime for each process
    processes.forEach(process => {
        process.startTime = null;
    });

    while (completed !== n) {
        let idx = -1;
        let highestPriority = Infinity;

        for (let i = 0; i < n; i++) {
            if (
                processes[i].arrivalTime <= currentTime &&
                processes[i].remainingTime > 0 &&
                processes[i].priority < highestPriority
            ) {
                highestPriority = processes[i].priority;
                idx = i;
            }
        }

        if (idx !== -1) {
            let process = processes[idx];

            if (process.startTime === null) {
                process.startTime = currentTime;
            }

            // Check for context switch
            if (prevProcessId !== process.id) {
                if (prevProcessId !== null) {
                    // End the previous process in the schedule
                    schedule[schedule.length - 1].endTime = currentTime;
                }
                // Start a new schedule entry for the current process
                schedule.push({
                    processId: process.id,
                    startTime: currentTime,
                    endTime: null, // Will be updated
                });
                prevProcessId = process.id;
            }

            // Execute process for 1 time unit
            process.remainingTime--;
            currentTime++;

            if (process.remainingTime === 0) {
                // Process has completed execution
                process.completionTime = currentTime;
                process.turnaroundTime = process.completionTime - process.arrivalTime;
                process.waitingTime = process.turnaroundTime - process.burstTime;
                completed++;

                // End the current process's schedule entry
                schedule[schedule.length - 1].endTime = currentTime;
                prevProcessId = null; // No process is currently running
            }
        } else {
            // CPU is idle
            if (prevProcessId !== null) {
                // End the previous process in the schedule
                schedule[schedule.length - 1].endTime = currentTime;
                prevProcessId = null;
            }
            currentTime++;
        }
    }

    // Ensure the last schedule entry is closed
    if (schedule.length > 0 && schedule[schedule.length - 1].endTime === null) {
        schedule[schedule.length - 1].endTime = currentTime;
    }

    const metrics = calculateMetrics(processes);
    return { processes, schedule, metrics };
}



function addTestData() {
    const testProcesses = [
        { arrivalTime: 0, burstTime: 20 },
        { arrivalTime: 3, burstTime: 12 },
        { arrivalTime: 4, burstTime: 7 },
        { arrivalTime: 0, burstTime: 25 },
        { arrivalTime: 5, burstTime: 24 },
    ];

    // Clear all rows except for the first one
    const tbody = document.querySelector('#process-table tbody');
    const rows = tbody.querySelectorAll('tr');
    
    if (rows.length > 0) {
        // Reset the first row (overwrite with the first test process)
        const firstRow = rows[0];
        firstRow.querySelector('.arrival-time').value = testProcesses[0].arrivalTime;
        firstRow.querySelector('.burst-time').value = testProcesses[0].burstTime;
    }

    // Remove all rows except the first one
    for (let i = rows.length - 1; i > 0; i--) {
        rows[i].remove();
    }

    // Add the remaining test processes (starting from the second one)
    for (let i = 1; i < testProcesses.length; i++) {
        addProcessRow();  // Add a new row for each remaining test process
        const lastRow = document.querySelector('#process-table tbody tr:last-child');
        lastRow.querySelector('.arrival-time').value = testProcesses[i].arrivalTime;
        lastRow.querySelector('.burst-time').value = testProcesses[i].burstTime;
    }

    // Reassign IDs to ensure proper ordering
    reassignProcessIds();
}


// Add event listener to the new "Add Test Data" button
document.getElementById('add-test-data').addEventListener('click', addTestData);
