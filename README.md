# 实现 PromiseA+

配合 README 与源码食用更佳。

Promise 有三种状态，分别是：

- pending：初始状态，未调用 resolve 或者 reject。
- fulfilled：调用了 resolve 后。
- rejected：调用了 reject 后。

状态只能从 pending 转换为 fulfilled 或 rejected，转换后不能再次转换。

state.js：

```js
const PENDING = 'pending'
const FULFILLED = 'fulfilled'
const REJECTED = 'rejected'

module.exports = {
  PENDING,
  FULFILLED,
  REJECTED
}
```

Promise 构造函数的参数是一个函数，创建实例时执行，函数有两个参数，分别为 resolve 和 reject。

Promise.js：

```js
const { PENDING, FULFILLED, REJECTED } = require('./state')

class Promise {
  constructor (fn) {
    this.state = PENDING
    this.value = null
    this.reason = null
    this.onFulfilledCallbacks = []
    this.onRejectedCallbacks = []

    const resolve = value => {
      // 模拟微任务
      setTimeout(() => {
        if (this.state === PENDING) {
          this.state = FULFILLED
          this.value = value
          this.onFulfilledCallbacks.forEach(cb => (cb(value)))
        }
      }, 0)
    }

    const reject = reason => {
      setTimeout(() => {
        if (this.state === PENDING) {
          this.state = REJECTED
          this.reason = reason
          this.onRejectedCallbacks.forEach(cb => (cb(reason)))
        }
      }, 0)
    }

    // 捕获异常，交给 Promise 处理
    try {
      fn(resolve, reject)
    } catch (error) {
      reject(error)
    }
  }
}

module.exports = Promise
```

Promise 拥有 then 方法，为了可以链式调用，then 方法的返回值为一个新的 Promise，编写 then 时要注意几点：

1、 then 支持链式调用，所以 then 需要返回一个新的 Promise。

2、链式调用时，上一个 then 的返回值是下一个 then 的回调参数。

```js
new Promise((resolve, reject) => {
  resolve('hello')
}).then(value => {
  return value + ' world'
}).then(value => {
  // hello world
  console.log(value)
})
```

3、链式调用时，then 的返回值有可能是一个 Promise，需要对其进行处理。

```js
new Promise((resolve, reject) => {
  resolve('hello')
}).then(value => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(value + ' world')
    }, 1000)
  })
}).then(value => {
  // 1s 后输出 hello world
  console.log(value)
})
```

4、链式调用时，then 的返回值有可能是一个 thenable，所谓 thenable，是一个拥有 then 方法的对象，此时需要将其视作一个 Promise 来处理。

```js
new Promise((resolve, reject) => {
  resolve('hello')
}).then(value => {
  // thenable 对象
  return {
    then: (resolve, reject) => {
      setTimeout(() => {
        resolve(value + ' world')
      }, 1000)
    }
  }
}).then(value => {
  // 1s 后输出 hello world
  console.log(value)
})
```

5、调用 then 时，需要防止 Promise 循环引用的问题。（第 4 点如果返回的是同一个 promise，会造成死循环）

```js
const p = new Promise((resolve, reject) => {
  resolve()
}).then(() => {
  // 产生循环引用
  return p
})
```

then.js：

```js
const { PENDING, FULFILLED, REJECTED } = require('./state')
const Promise = require('./Promise')
const resolvePromise = require('./resolvePromise')

module.exports = function (onFulfilled, onRejected) {
  // 默认值
  const onFulfilledCallback = isFunction(onFulfilled) ? onFulfilled : value => value
  const onRejectedCallback = isFunction(onRejected) ? onRejected : reason => { throw reason }

  // 为了链式调用，返回一个新的 Promise
  const promise2 = new Promise((resolve, reject) => {
    setTimeout(() => {
      switch (this.state) {
        // 如果状态为 fulfilled（一开始就调用了 resolve）
        case FULFILLED:
          try {
            const result = onFulfilledCallback(this.value)
            resolvePromise(promise2, result, resolve, reject)
          } catch (error) {
            reject(error)
          }
          break

        // 如果状态为 fulfilled（一开始就调用了 resolve）
        case REJECTED:
          try {
            const result = onRejectedCallback(this.value)
            resolvePromise(promise2, result, resolve, reject)
          } catch (error) {
            reject(error)
          }
          break

        // 如果状态为 pending，推到队列中等待消费
        case PENDING:
          this.onFulfilledCallbacks.push(value => {
            try {
              const result = onFulfilledCallback(value)
              resolvePromise(promise2, result, resolve, reject)
            } catch (error) {
              reject(error)
            }
          })
          this.onRejectedCallbacks.push(reason => {
            try {
              const result = onRejectedCallback(reason)
              resolvePromise(promise2, result, resolve, reject)
            } catch (error) {
              reject(error)
            }
          })
      }
    }, 0)
  })

  return promise2
}

function isFunction (value) {
  return typeof value === 'function'
}
```

resolvePromise.js：

```js
const Promise = require('./Promise')

function resolvePromise (promise2, result, resolve, reject) {
  // 解决循环引用问题
  if (promise2 === result) {
    reject(new TypeError('error due to circular reference'))
    return
  }

  // 处理 result 是 Promise 的情况
  if (result instanceof Promise) {
    result.then(value => {
      // 递归，因为 value 可能还是 Promise
      resolvePromise(promise2, value, resolve, reject)
    }, reject)
    return
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

function toRawType (val) {
  return Object.prototype.toString.call(val).slice(8, -1)
}

module.exports = resolvePromise
```
