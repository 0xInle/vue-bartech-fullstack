import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { useRegisterForm } from '../composables/useRegisterValidate'

describe('useRegisterForm', () => {
  function setup() {
    let form: ReturnType<typeof useRegisterForm>

    mount({
      template: '<div></div>',
      setup() {
        form = useRegisterForm()
        return {}
      },
    })

    return form!
  }

  it('имеет начальные значения', () => {
    const form = setup()

    expect(form.email.value).toBe('')
    expect(form.password.value).toBe('')
    expect(form.confirmPassword.value).toBe('')
  })

  it('показывает ошибку если пароли не совпадают', async () => {
    const form = setup()

    form.password.value = '123456'
    form.confirmPassword.value = '23456'

    await form.handleSubmit(() => {})()

    expect(form.confirmPasswordError.value).toBeTruthy()
  })

  it('валиден при корректных данных', async () => {
    const form = setup()

    form.email.value = 'test@gmail.com'
    form.password.value = '123456'
    form.confirmPassword.value = '123456'

    await form.handleSubmit(() => {})()

    expect(form.emailError.value).toBeUndefined()
    expect(form.passwordError.value).toBeUndefined()
    expect(form.confirmPasswordError.value).toBeUndefined()
  })

  it('показывает ошибку если пароль короткий', async () => {
    const form = setup()

    form.password.value = '123'

    await form.handleSubmit(() => {})()

    expect(form.passwordError.value).toBeTruthy()
  })
})
