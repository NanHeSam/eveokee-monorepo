import { SignUp } from '@clerk/clerk-react'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Join eveokee</h1>
          <p className="text-gray-600">Create your account and start your journey</p>
        </div>
        <SignUp 
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-xl border-0 bg-white/80 backdrop-blur-sm",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton: "bg-white border border-gray-200 hover:bg-gray-50 text-gray-700",
              socialButtonsBlockButtonText: "font-medium",
              formButtonPrimary: "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700",
              footerActionLink: "text-purple-600 hover:text-purple-700"
            }
          }}
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          redirectUrl="/"
        />
      </div>
    </div>
  )
}