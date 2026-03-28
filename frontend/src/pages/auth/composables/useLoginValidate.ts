import { useForm, useField } from 'vee-validate'
import * as yup from 'yup'

const schema = yup.object({
  email: yup.string().required('Введите email').email('Неверный формат email'),
  password: yup.string().required('Введите пароль').min(6, 'Минимум 6 символов'),
})

export function useLoginForm() {
  const { handleSubmit, meta } = useForm({
    validationSchema: schema,
    initialValues: {
      email: '',
      password: '',
    },
  })

  const { value: email, errorMessage: emailError } = useField<string>('email')
  const { value: password, errorMessage: passwordError } = useField<string>('password')

  return {
    handleSubmit,
    meta,
    email,
    emailError,
    password,
    passwordError,
  }
}
