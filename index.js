const globby = require('globby')
const fp = require('fastify-plugin')
const Bounce = require('@hapi/bounce')

module.exports = fp(async (fastify, options, next) => {
  const { path: serviceDirectory } = options
  if (!serviceDirectory) {
    throw new Error('需要传path参数以指明services的目录')
  }
  const servicePaths = await globby(serviceDirectory)
  let services = {}
  servicePaths.map(require).forEach(ServiceConstructor => {
    const serviceInstance = new ServiceConstructor(fastify)
    const metchods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(serviceInstance)
    ).filter(key => key !== 'constructor')
    let temp = {}
    metchods.forEach(metchod => {
      temp[metchod] = async (...rest) => {
        try {
          const ret = await serviceInstance[metchod](...rest)
          return {
            success: true,
            data: ret
          }
        } catch (err) {
          // 对于系统错误应该重新抛出返回500，并被错误日志记录下来
          Bounce.rethrow(err, 'system')
          return {
            success: false,
            errMsg: err && err.message
          }
        }
      }
    })
    services[ServiceConstructor.name] = temp
  })
  fastify.decorate('service', services)
  next()
})
