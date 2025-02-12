/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
  	fontFamily: {
  		body: [
  			'Inter',
  			'Vazirmatn',
  			'ui-sans-serif',
  			'system-ui',
  			'sans-serif',
  			'Apple Color Emoji',
  			'Segoe UI Emoji',
  			'Segoe UI Symbol',
  			'Noto Color Emoji'
  		]
  	},
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			'input-placeholder': 'hsl(var(--input-placeholder))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		fontFamily: {
  			yekan: [
  				'YekanBakh',
  				'Arial',
  				'sans-serif'
  			]
  		},
  		keyframes: {
  			pulseAnimation: {
  				'0%': {
  					boxShadow: '0 0 0 0px rgba(0, 0, 0, 0.4)'
  				},
  				'100%': {
  					boxShadow: '0 0 0 10px rgba(0, 0, 0, 0)'
  				}
  			},
  			greenPulseAnimation: {
  				'0%': {
  					boxShadow: '0 0 0 0px #66ff9975'
  				},
  				'100%': {
  					boxShadow: '0 0 0 10px #66ff9900'
  				}
  			},
  			redPulseAnimation: {
  				'0%': {
  					boxShadow: '0 0 0 0px #e53e3e8c'
  				},
  				'100%': {
  					boxShadow: '0 0 0 10px #e53e3e00'
  				}
  			},
  			orangePulseAnimation: {
  				'0%': {
  					boxShadow: '0 0 0 0px #fbd38d85'
  				},
  				'100%': {
  					boxShadow: '0 0 0 10px #fbd38d00'
  				}
  			},
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			pulse: 'pulseAnimation 3s infinite',
  			greenPulse: 'greenPulseAnimation 3s infinite',
  			redPulse: 'redPulseAnimation 3s infinite',
  			orangePulse: 'orangePulseAnimation 3s infinite',
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require('tailwindcss-animate')],
}
