interface HelloWorldProps {
  message?: string;
}

export default function HelloWorld({ message = "Hello World" }: HelloWorldProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="text-center space-y-6 p-8 max-w-md">
        <h1 className="text-4xl font-bold text-primary-600">
          {message}
        </h1>
        <p className="text-lg text-gray-600">
          Welcome to the Homeschool Learning Platform
        </p>
        <div className="flex gap-4 justify-center">
          <button className="btn-primary">
            Get Started
          </button>
          <button className="btn-secondary">
            Learn More
          </button>
        </div>
      </div>
    </div>
  );
}