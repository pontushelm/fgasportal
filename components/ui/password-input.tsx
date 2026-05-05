"use client"

import { forwardRef, useState, type InputHTMLAttributes } from "react"
import { Eye, EyeOff } from "lucide-react"

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className = "", ...props }, ref) {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false)
    const Icon = isPasswordVisible ? EyeOff : Eye

    return (
      <div className="relative">
        <input
          ref={ref}
          className={`${className} pr-10`}
          type={isPasswordVisible ? "text" : "password"}
          {...props}
        />
        <button
          aria-label={isPasswordVisible ? "Dölj lösenord" : "Visa lösenord"}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-800"
          type="button"
          onClick={() => setIsPasswordVisible((visible) => !visible)}
        >
          <Icon aria-hidden="true" className="h-4 w-4 cursor-pointer" />
        </button>
      </div>
    )
  }
)
