const form = document.getElementById('form')
 
form.addEventListener('submit', async (e) => {
  e.preventDefault()
 
  const firstname = document.getElementById('firstname').value
  const middlename = document.getElementById('middlename').value
  const lastname = document.getElementById('lastname').value
 
  const { error } = await supabase
    .from('submissions')
    .insert({
      firstname,
      middlename,
      lastname
    })
 
  if (error) {
    alert(error.message)
  } else {
    alert('Submitted!')
    form.reset()
  }
})