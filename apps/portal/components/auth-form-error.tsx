export function AuthFormError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p role="alert" className="text-sm text-red-600 mt-1">
      {message}
    </p>
  );
}
