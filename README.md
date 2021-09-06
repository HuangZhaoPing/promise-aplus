# 实现 PromiseA+

配合 README 与源码食用更佳。

Promise 有三种状态，分别是：

- pending：初始状态，未调用 resolve 或者 reject。
- fulfilled：调用了 resolve 后。
- rejected：调用了 reject 后。

状态只能从 pending 转换为 fulfilled 或 rejected，转换后不能再次转换。

```js
const STATUS = {
  PENDING: 'pending', // 初始状态，未调用 resolve 或者 reject。
  FULFILLED: 'fulfilled', // 调用了 resolve 后。
  REJECTED: 'rejected' // 调用了 reject 后。
}
```

Promise 构造函数的参数是一个函数，创建实例时执行，函数有两个参数，分别为 resolve 和 reject。

```js
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

then：

```js
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


```

resolvePromise：

```js
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
```
