import { useEffect } from 'react'

export function ErrorToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div role="alert" className="pixel-panel fixed top-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] items-start gap-3 !bg-[#a44339] p-3 !text-[#fff8df]">
      <p className="min-w-0 flex-1 text-xl leading-6 break-words">{message}</p>
      <button type="button" onClick={onClose} aria-label="Fermer l’alerte" className="pixel-icon-button size-8 shrink-0 text-2xl leading-none"><span aria-hidden="true">×</span></button>
    </div>
  )
}
