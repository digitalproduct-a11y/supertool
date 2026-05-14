import { useNavigate } from 'react-router-dom'
import { IconChevronLeft } from '@tabler/icons-react'

export function BackButton() {
  const navigate = useNavigate()

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/home')
    }
  }

  return (
    <button
      onClick={handleBack}
      className="p-2 hover:bg-neutral-100 rounded-lg transition text-neutral-600 hover:text-neutral-950"
    >
      <IconChevronLeft className="w-5 h-5" />
    </button>
  )
}
