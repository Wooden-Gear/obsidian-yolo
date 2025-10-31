import { useEffect, useRef, useState } from 'react'

import { useLanguage } from '../../contexts/language-context'
import { useObsidianSetting } from './ObsidianSetting'

export type SearchableDropdownProps = {
  value: string
  options: string[]
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  loading?: boolean
}

export function SearchableDropdown({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = 'Search...',
  loading = false,
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const { setting } = useObsidianSetting()

  // Mount component to setting's control area if setting exists
  useEffect(() => {
    if (setting && containerRef.current) {
      // Move our container to the setting's control element
      setting.controlEl.appendChild(containerRef.current)
      
      return () => {
        // Clean up on unmount
        if (containerRef.current && setting.controlEl.contains(containerRef.current)) {
          setting.controlEl.removeChild(containerRef.current)
        }
      }
    }
  }, [setting])

  // Filter options based on search query (case-insensitive fuzzy match)
  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setSelectedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          )
          break
        case 'ArrowUp':
          event.preventDefault()
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
          break
        case 'Enter':
          event.preventDefault()
          if (selectedIndex >= 0 && selectedIndex < filteredOptions.length) {
            handleSelect(filteredOptions[selectedIndex])
          }
          break
        case 'Escape':
          event.preventDefault()
          setIsOpen(false)
          break
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isOpen, selectedIndex, filteredOptions])

  // Scroll selected item into view
  useEffect(() => {
    if (isOpen && selectedIndex >= 0 && listRef.current) {
      const selectedElement = listRef.current.children[
        selectedIndex
      ] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        })
      }
    }
  }, [selectedIndex, isOpen])

  // Reset selected index when search query changes
  useEffect(() => {
    setSelectedIndex(-1)
  }, [searchQuery])

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue)
    setSearchQuery('')
    setSelectedIndex(-1)
    setIsOpen(false)
  }

  const handleInputFocus = () => {
    setIsOpen(true)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setIsOpen(true)
  }

  const { t } = useLanguage()

  return (
    <div
      ref={containerRef}
      className="smtcmp-searchable-dropdown"
      style={{ position: 'relative' }}
    >
      {/* Input field */}
      <input
        ref={inputRef}
        type="text"
        className="smtcmp-searchable-dropdown__input"
        value={searchQuery}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        placeholder={
          disabled
            ? 'Disabled'
            : loading
              ? 'Loading...'
              : placeholder
        }
        disabled={disabled || loading}
      />

      {/* Dropdown list */}
      {isOpen && !disabled && !loading && (
        <div className="smtcmp-searchable-dropdown__list" ref={listRef}>
          {filteredOptions.length === 0 ? (
            <div className="smtcmp-searchable-dropdown__empty">
              {t('common.noResults') ?? 'No matches found'}
            </div>
          ) : (
            filteredOptions.map((option, index) => (
              <div
                key={option}
                className={`smtcmp-searchable-dropdown__item ${
                  index === selectedIndex
                    ? 'smtcmp-searchable-dropdown__item--selected'
                    : ''
                } ${
                  option === value
                    ? 'smtcmp-searchable-dropdown__item--current'
                    : ''
                }`}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {option}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
