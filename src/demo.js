// const p = new CustomPromise((reslove, reject) => {
//   setTimeout(() => {
//     reject('hello')
//   }, 1000)
// })

/* eslint-disable */
new Promise2((resolve, reject) => {
  reject('asdf')
}).then(value => {
  console.log(value)
  return value + '123'
}).then(value => {
  console.log(value)
}).catch(err => {
  console.log(err)
})
