new window.CustomPromise((reslove, reject) => {
  reslove('hello')
}).then(value => {
  console.log(value)
})
