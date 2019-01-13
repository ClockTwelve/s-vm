


var data = {
  message: 'Im a ruthless message',
  anotherMessage: 'I think so too'
}
observe(data)
watch(data, 'message', function(oVal, nVal) {
  console.log(`message already be changed, oldValue:${oVal}, newValue:${nVal}`)
})
compute(data, 'computedMessage', function getter() {
  return this.message + ',' + this.anotherMessage
})
watch(data, 'computedMessage', function(oVal, nVal) {
  console.log(`computedMessage changed, oVal: ${oVal};   nVal: ${nVal}`)
})

document.getElementById('changeMessage').addEventListener('click', function() {
  data.message = 'Im a happy message'
})
document.getElementById('changeAnotherMessage').addEventListener('click', function() {
  data.anotherMessage = 'no, you\'re not'
})
document.getElementById('changeBoth').addEventListener('click', function() {
  data.message = 'Im a happy message'
  data.anotherMessage = 'no, you\'re not'
})
document.getElementById('resetMessage').addEventListener('click', function() {
  data.message = 'Im a ruthless message'
  data.anotherMessage = 'I think so too'
})