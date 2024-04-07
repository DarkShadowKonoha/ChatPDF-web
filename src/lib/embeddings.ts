import { OpenAIApi, Configuration } from "openai-edge";

const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(config);

export async function getEmbeddings(text: string) {
  try {
    const response = await openai.createEmbedding({
      model: "text-embedding-ada-002",
      input: text,
    });

    const result = await response.json();
    console.log("Response from OpenAI API:", result); // Log the response

    if (result && result.data && result.data.length > 0) {
      return result.data[0].embedding as number[];
    } else if (result.error) {
      console.error("Error from OpenAI API:", result.error.message);
      throw new Error("Rate limit exceeded");
    } else {
      console.error("Unexpected response format from OpenAI API");
      throw new Error("Unexpected response format from OpenAI API");
    }
  } catch (error) {
    console.error("Error calling OpenAI embeddings API", error);
    throw error;
  }
}
