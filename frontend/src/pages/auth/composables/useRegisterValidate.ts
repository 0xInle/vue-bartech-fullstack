import { useForm, useField } from 'vee-validate'
import * as yup from 'yup'

const schema = yup.object({
  email: yup.string().required('Введите email').email('Неверный формат email'),
  password: yup.string().required('Введите пароль').min(6, 'Минимум 6 символов'),
  confirmPassword: yup
    .string()
    .required('Подтвердите пароль')
    .oneOf([yup.ref('password')], 'Пароли не совпадают'),
})

export function useRegisterForm() {
  const { handleSubmit, meta } = useForm({
    validationSchema: schema,
    initialValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const { value: email, errorMessage: emailError } = useField<string>('email')
  const { value: password, errorMessage: passwordError } = useField<string>('password')
  const { value: confirmPassword, errorMessage: confirmPasswordError } =
    useField<string>('confirmPassword')

  return {
    handleSubmit,
    meta,
    email,
    emailError,
    password,
    passwordError,
    confirmPassword,
    confirmPasswordError,
  }
}
