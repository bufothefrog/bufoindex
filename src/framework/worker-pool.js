/**
 * Worker Pool - Manage Web Workers for heavy calculations
 * Provides queue management and load balancing for financial computations
 */

export class WorkerPool {
  constructor() {
    this.workers = [];
    this.taskQueue = [];
    this.activeTasksCount = 0;
    this.maxWorkers = navigator.hardwareConcurrency || 4;
    this.workerScript = null;
    this.ready = false;
  }

  /**
   * Initialize worker pool
   * @param {string} workerScriptPath - Path to worker script
   * @param {number} maxWorkers - Maximum number of workers
   */
  async initialize(workerScriptPath, maxWorkers = null) {
    this.workerScript = workerScriptPath;
    this.maxWorkers = maxWorkers || this.maxWorkers;
    
    // Create initial workers
    const initialWorkerCount = Math.min(2, this.maxWorkers);
    for (let i = 0; i < initialWorkerCount; i++) {
      await this.createWorker();
    }
    
    this.ready = true;
    console.log(`Worker pool initialized with ${this.workers.length} workers`);
  }

  /**
   * Create a new worker
   */
  async createWorker() {
    return new Promise((resolve, reject) => {
      try {
        const worker = new Worker(this.workerScript, { type: 'module' });
        
        worker.onmessage = (e) => this.handleWorkerMessage(worker, e);
        worker.onerror = (error) => this.handleWorkerError(worker, error);
        
        worker.postMessage({ type: 'init' });
        
        const workerData = {
          worker,
          id: this.workers.length,
          busy: false,
          currentTask: null,
          resolve,
          reject
        };
        
        worker._poolData = workerData;
        this.workers.push(workerData);
        
        // Resolve after worker confirms initialization
        setTimeout(() => resolve(workerData), 100);
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle worker message
   * @param {Worker} worker - Worker instance
   * @param {MessageEvent} event - Message event
   */
  handleWorkerMessage(worker, event) {
    const workerData = worker._poolData;
    const { type, taskId, result, error } = event.data;
    
    switch (type) {
      case 'ready':
        console.log(`Worker ${workerData.id} ready`);
        break;
        
      case 'result':
        if (workerData.currentTask && workerData.currentTask.id === taskId) {
          this.completeTask(workerData, result);
        }
        break;
        
      case 'error':
        if (workerData.currentTask && workerData.currentTask.id === taskId) {
          this.failTask(workerData, new Error(error.message));
        }
        break;
        
      default:
        console.warn('Unknown worker message type:', type);
    }
  }

  /**
   * Handle worker error
   * @param {Worker} worker - Worker instance
   * @param {ErrorEvent} error - Error event
   */
  handleWorkerError(worker, error) {
    const workerData = worker._poolData;
    console.error(`Worker ${workerData.id} error:`, error);
    
    if (workerData.currentTask) {
      this.failTask(workerData, error);
    }
    
    // Replace failed worker
    this.replaceWorker(workerData);
  }

  /**
   * Execute task in worker pool
   * @param {string} method - Method name to execute
   * @param {*} data - Data to pass to worker
   * @param {Object} options - Execution options
   * @returns {Promise} Promise that resolves with result
   */
  execute(method, data, options = {}) {
    return new Promise((resolve, reject) => {
      const task = {
        id: Date.now() + Math.random(),
        method,
        data,
        options,
        resolve,
        reject,
        timestamp: Date.now(),
        timeout: options.timeout || 30000
      };
      
      this.taskQueue.push(task);
      this.processQueue();
    });
  }

  /**
   * Process task queue
   */
  processQueue() {
    if (this.taskQueue.length === 0) return;
    
    // Find available worker
    const availableWorker = this.workers.find(w => !w.busy);
    
    if (availableWorker) {
      const task = this.taskQueue.shift();
      this.assignTask(availableWorker, task);
    } else if (this.workers.length < this.maxWorkers) {
      // Create new worker if under limit
      this.createWorker().then(() => this.processQueue());
    }
    // Otherwise wait for worker to become available
  }

  /**
   * Assign task to worker
   * @param {Object} workerData - Worker data
   * @param {Object} task - Task to assign
   */
  assignTask(workerData, task) {
    workerData.busy = true;
    workerData.currentTask = task;
    this.activeTasksCount++;
    
    // Set timeout for task
    task.timeoutId = setTimeout(() => {
      this.failTask(workerData, new Error('Task timeout'));
    }, task.timeout);
    
    // Send task to worker
    workerData.worker.postMessage({
      type: 'execute',
      taskId: task.id,
      method: task.method,
      data: task.data,
      options: task.options
    });
  }

  /**
   * Complete task successfully
   * @param {Object} workerData - Worker data
   * @param {*} result - Task result
   */
  completeTask(workerData, result) {
    const task = workerData.currentTask;
    if (!task) return;
    
    clearTimeout(task.timeoutId);
    workerData.busy = false;
    workerData.currentTask = null;
    this.activeTasksCount--;
    
    task.resolve(result);
    
    // Process next task in queue
    this.processQueue();
  }

  /**
   * Fail task with error
   * @param {Object} workerData - Worker data
   * @param {Error} error - Task error
   */
  failTask(workerData, error) {
    const task = workerData.currentTask;
    if (!task) return;
    
    clearTimeout(task.timeoutId);
    workerData.busy = false;
    workerData.currentTask = null;
    this.activeTasksCount--;
    
    task.reject(error);
    
    // Process next task in queue
    this.processQueue();
  }

  /**
   * Replace failed worker
   * @param {Object} workerData - Failed worker data
   */
  async replaceWorker(workerData) {
    // Remove failed worker
    const index = this.workers.indexOf(workerData);
    if (index > -1) {
      this.workers.splice(index, 1);
      workerData.worker.terminate();
    }
    
    // Create replacement worker
    try {
      await this.createWorker();
      this.processQueue();
    } catch (error) {
      console.error('Failed to replace worker:', error);
    }
  }

  /**
   * Get pool statistics
   * @returns {Object} Pool statistics
   */
  getStats() {
    return {
      totalWorkers: this.workers.length,
      busyWorkers: this.workers.filter(w => w.busy).length,
      queuedTasks: this.taskQueue.length,
      activeTasks: this.activeTasksCount,
      ready: this.ready
    };
  }

  /**
   * Check if pool is ready
   * @returns {boolean} Whether pool is ready
   */
  isReady() {
    return this.ready && this.workers.length > 0;
  }

  /**
   * Terminate all workers
   */
  terminate() {
    this.workers.forEach(workerData => {
      workerData.worker.terminate();
    });
    
    this.workers = [];
    this.taskQueue = [];
    this.activeTasksCount = 0;
    this.ready = false;
  }

  /**
   * Terminate idle workers to save memory
   */
  cleanup() {
    const idleWorkers = this.workers.filter(w => !w.busy);
    const keepWorkers = Math.min(2, this.maxWorkers); // Keep at least 2 workers
    
    if (idleWorkers.length > keepWorkers) {
      const workersToTerminate = idleWorkers.slice(keepWorkers);
      
      workersToTerminate.forEach(workerData => {
        const index = this.workers.indexOf(workerData);
        if (index > -1) {
          this.workers.splice(index, 1);
          workerData.worker.terminate();
        }
      });
      
      console.log(`Cleaned up ${workersToTerminate.length} idle workers`);
    }
  }
}