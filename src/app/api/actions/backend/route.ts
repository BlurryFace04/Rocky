import {
  ActionPostResponse,
  createActionHeaders,
  createPostResponse,
  ActionPostRequest,
  MEMO_PROGRAM_ID,
  ACTIONS_CORS_HEADERS
} from "@solana/actions"
import {
  clusterApiUrl,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from "@solana/web3.js"
import bs58 from "bs58"
import { connectToDB } from '@/utils/database'
import Rocky from '@/models/rocky'

const ADDRESS = new PublicKey("HBQwJcDCqEHr8b7LGzww1t8NxAaM9rQjA7QHSuWL7jnD")

export const POST = async (req: Request) => {
  await connectToDB()

  try {
    // Extract the query parameters from the URL
    const url = new URL(req.url)
    const amount = url.searchParams.get("amount")
    const choice = url.searchParams.get("choice")
    // const player = url.searchParams.get("player")

    let label: string = ""

    const body: ActionPostRequest = await req.json()
    // Validate to confirm the user publickey received is valid before use
    let account: PublicKey
    try {
      account = new PublicKey(body.account)
    } catch (err) {
      return new Response('Invalid "account" provided', {
        status: 400,
        headers: ACTIONS_CORS_HEADERS
      })
    }

    if (!amount || !choice) {
      return new Response('Missing required parameters', {
        status: 400,
        headers: ACTIONS_CORS_HEADERS
      })
    }

    // return new Response(JSON.stringify({ message: "Under maintenance, please try again later." }), {
    //   status: 403,
    //   headers: {
    //     ...ACTIONS_CORS_HEADERS,
    //     'Content-Type': 'application/json'
    //   }
    // })

    const reference = Keypair.generate()

    const connection = new Connection(`https://staked.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`)
    const transaction = new Transaction()

    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1000
      }),
      new TransactionInstruction({
        programId: new PublicKey(MEMO_PROGRAM_ID),
        data: Buffer.from(`${choice}_${amount}`, "utf8"),
        keys: [
          { pubkey: reference.publicKey, isSigner: true, isWritable: false }
        ]
      }),
      SystemProgram.transfer({
        fromPubkey: account,
        toPubkey: ADDRESS,
        lamports: Math.round(Number(amount) * LAMPORTS_PER_SOL)
      })
    )

    transaction.feePayer = account

    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash

    const r = await Rocky.create({
      address: account.toString(),
      choice: choice,
      amount: Number(amount)
    })

    console.log("Rocky ID:", r._id)

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        type: "transaction",
        transaction,
        links: {
          next: {
            type: "post",
            href: `/api/actions/outcome?id=${r._id.toString()}`
          }
        }
      },
      signers: [reference],
      reference: reference.publicKey
    })

    console.log("Payload:", payload)

    return Response.json(payload, {
      headers: ACTIONS_CORS_HEADERS,
    })

  } catch (err) {
    console.error(err)
    return Response.json("An unknown error occured", { status: 500 })
  }
}
