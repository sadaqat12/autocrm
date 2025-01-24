interface LogoProps {
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

export default function Logo({ className = '', size = 'medium' }: LogoProps) {
  const sizes = {
    small: 'h-6 w-6',
    medium: 'h-8 w-8',
    large: 'h-10 w-10'
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <svg
        className={sizes[size]}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Main circle */}
        <circle cx="20" cy="20" r="18" fill="#4F46E5" />
        
        {/* Automation arrows */}
        <path
          d="M20 8C13.373 8 8 13.373 8 20"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 20 20"
            to="360 20 20"
            dur="10s"
            repeatCount="indefinite"
          />
        </path>
        
        {/* CRM symbol */}
        <path
          d="M16 20a4 4 0 108 0 4 4 0 00-8 0zM16 28c0-2.21 1.79-4 4-4s4 1.79 4 4"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className={`font-semibold ${size === 'small' ? 'text-lg' : size === 'large' ? 'text-2xl' : 'text-xl'}`}>
        AutoCRM
      </span>
    </div>
  );
} 