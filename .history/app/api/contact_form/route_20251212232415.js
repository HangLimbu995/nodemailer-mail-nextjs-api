if (!parsedData.success) {
  // handle invalid data
  return new Response(
    JSON.stringify({
      success: false,
      message: "Invalid input.",
      errors: parsedData.error ? parsedData.error.issues : [],
    }),
    { status: 400 }
  );
}
  } catch (error) {}
}
