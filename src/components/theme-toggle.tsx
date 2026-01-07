'use client'

import * as React from 'react'
import { LaptopIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Toggle theme">
          <SunIcon className="size-4 dark:hidden" />
          <MoonIcon className="hidden size-4 dark:block" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            setTheme('light')
          }}
        >
          <SunIcon className="mr-2 size-4" />
          Light
          {theme === 'light' ? <span className="ml-auto text-xs">✓</span> : null}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            setTheme('dark')
          }}
        >
          <MoonIcon className="mr-2 size-4" />
          Dark
          {theme === 'dark' ? <span className="ml-auto text-xs">✓</span> : null}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            setTheme('system')
          }}
        >
          <LaptopIcon className="mr-2 size-4" />
          System
          {theme === 'system' ? <span className="ml-auto text-xs">✓</span> : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
