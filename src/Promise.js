// 状态
const STATUS = {
  PENDING: 'pending', // 初始状态，未调用 resolve 或者 reject。
  FULFILLED: 'fulfilled', // 调用了 resolve 后。
  REJECTED: 'rejected' // 调用了 reject 后。
}

class CustomPromise {
  constructor (fn) {
    // 初始状态为 pending
    this.status = STATUS.PENDING
    this.value = null
    this.reason = null
    // fulfilled 队列
    this.onFulfilledCallbacks = []
    // rejected 队列
    this.onRejectedCallbacks = []

    const resolve = value => {
      // 微任务
      queueMicrotask(() => {
        if (this.status === STATUS.PENDING) {
          this.status = STATUS.FULFILLED
          this.value = value
          this.onFulfilledCallbacks.forEach(cb => (cb(value)))
        }
      })
    }

    const reject = reason => {
      queueMicrotask(() => {
        if (this.status === STATUS.PENDING) {
          this.status = STATUS.REJECTED
          this.reason = reason
          this.onRejectedCallbacks.forEach(cb => (cb(reason)))
        }
      })
    }

    try {
      fn(resolve, reject)
    } catch (error) {
      reject(error)
    }
  }
}

function then (onFulfilled, onRejected) {
  // 默认值
  const onFulfilledCallback = typeof onFulfilled === 'function' ? onFulfilled : value => value
  const onRejectedCallback = typeof onRejected === 'function' ? onRejected : reason => { throw reason }

  // 为了链式调用，返回一个新的 Promise
  const promise2 = new CustomPromise((resolve, reject) => {
    switch (this.status) {
      // 如果状态为 fulfilled（一开始就调用了 resolve）
      case STATUS.FULFILLED:
        try {
          queueMicrotask(() => {
            resolvePromise(promise2, null, resolve, reject)
          })
        } catch (error) {
          reject(error)
        }
        break

        // 如果状态为 fulfilled（一开始就调用了 reject））
      case STATUS.REJECTED:
        try {
          queueMicrotask(() => {
            resolvePromise(promise2, null, resolve, reject)
          })
        } catch (error) {
          reject(error)
        }
        break

        // 如果状态为 pending，推到队列中等待消费
      case STATUS.PENDING:
        this.onFulfilledCallbacks.push(value => {
          try {
            queueMicrotask(() => {
              const result = onFulfilledCallback(value)
              resolvePromise(promise2, result, resolve, reject)
            })
          } catch (error) {
            reject(error)
          }
        })

        if (typeof onRejected === 'function') {
          this.onRejectedCallbacks.push(reason => {
            try {
              queueMicrotask(() => {
                const result = onRejectedCallback(reason)
                resolvePromise(promise2, result, resolve, reject)
              })
            } catch (error) {
              reject(error)
            }
          })
        }
    }
  })

  return promise2
}

function resolvePromise (promise2, result, resolve, reject) {
  // 解决循环引用问题
  if (promise2 === result) {
    reject(new TypeError('error due to circular reference'))
    return
  }

  // 处理 result 是 Promise 的情况
  if (result instanceof CustomPromise) {
    result.then(value => {
      // 递归，因为 value 可能还是 Promise
      resolvePromise(promise2, value, resolve, reject)
    }, reject)
    return
  }

  const toRawType = val => {
    return Object.prototype.toString.call(val).slice(8, -1)
  }

  // 处理 result 是 thenable 的情况
  if (toRawType(result) === 'Object' || toRawType(result) === 'Function') {
    const then = result.then
    if (toRawType(then) === 'Function') {
      then.call(result, value => {
        resolvePromise(promise2, value, resolve, reject)
      }, reason => {
        reject(reason)
      })
    }
    return
  }

  resolve(result)
}

function catch_ (onRejected) {
  return this.then(null, onRejected)
}

function finally_ (callback) {
  return this.then(() => {
    callback()
  }, () => {
    callback()
  })
}

function all (promises) {
  return new CustomPromise((resolve, reject) => {
    try {
      const results = []
      promises.forEach(promise => {
        promise.then(value => {
          results.push(value)
        }, reject)
      })
    } catch (e) {
      reject(e)
    }
  })
}

function race (promises) {
  return new Promise((resolve, reject) => {
    try {
      promises.forEach(promise => {
        promise.then(resolve, reject)
      })
    } catch (e) {
      reject(e)
    }
  })
}

CustomPromise.prototype = Object.assign(CustomPromise.prototype, {
  then,
  catch: catch_,
  finally: finally_
})

CustomPromise.all = all
CustomPromise.race = race
