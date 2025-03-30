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
  Commitment,
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
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'
import { connectToDB } from '@/utils/database'
import EclipseGame from '@/models/eclipse_game'

const ADDRESS = new PublicKey("BGh13zVibtk3kge1K3u8kTbfk4Zyqmf7coqm8YoU6Wio")

export const POST = async (req: Request) => {
  await connectToDB()

  try {
    const body: any = await req.json()
    console.log("Fuckin Body: ", body)

    let account: PublicKey
    try {
      account = new PublicKey(body.account)
    } catch (err) {
      return new Response(JSON.stringify({ message: "Invalid account" }), {
        status: 403,
        headers: {
          ...ACTIONS_CORS_HEADERS,
          'Content-Type': 'application/json'
        }
      })
    }

    const url = new URL(req.url)
    const id = url.searchParams.get("id")

    if (!id) {
      return new Response('Missing required parameters', {
        status: 400,
        headers: ACTIONS_CORS_HEADERS
      })
    }

    const game = await EclipseGame.findById(id)
    console.log("Game: ", game)

    if (!game) {
      game.fake = true
      await game.save()

      return new Response(JSON.stringify({ message: "Game not found" }), {
        status: 403,
        headers: {
          ...ACTIONS_CORS_HEADERS,
          'Content-Type': 'application/json'
        }
      })
    }

    if (game.claimed) {
      return new Response(JSON.stringify({ message: "Reward already claimed!" }), {
        status: 403,
        headers: {
          ...ACTIONS_CORS_HEADERS,
          'Content-Type': 'application/json'
        }
      })
    }

    const signature = game.signature

    let txData
    let attempts = 0
    const maxAttempts = 20

    while (attempts < maxAttempts) {
      console.log(`Attempt number: ${attempts + 1}`)

      const tx_payload = {
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [
          signature,
          "json"
        ]
      };
  
      try {
        const response = await fetch("https://mainnetbeta-rpc.eclipse.xyz", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(tx_payload)
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        txData = await response.json();

        if (txData.result && txData.result.meta.postBalances.length > 0) {
          console.log("Eclipse Tx Data: ", txData);
          console.log("Post Balances: ", txData.result.meta.postBalances)
          console.log("Pre Balances: ", txData.result.meta.preBalances)
          console.log("Transaction Message: ", txData.result.transaction.message)
          break
        }

      } catch (error) {
        console.error("Error fetching transaction:", error);
      }

      attempts++
      if (attempts >= maxAttempts) {
        game.fake = true
        await game.save()

        return new Response(JSON.stringify({ message: "Payment could not be confirmed!" }), {
          status: 403,
          headers: {
            ...ACTIONS_CORS_HEADERS,
            'Content-Type': 'application/json'
          }
        })
      }

      await new Promise(resolve => setTimeout(resolve, 500)) // wait for 0.5 seconds
    }

    // console.log(txData[0].nativeTransfers)

    if (txData.result.transaction.message.accountKeys[0] !== account.toBase58()) {
      game.fake = true
      await game.save()

      return new Response(JSON.stringify({ message: "Payment was not made by you!" }), {
        status: 403,
        headers: {
          ...ACTIONS_CORS_HEADERS,
          'Content-Type': 'application/json'
        }
      })
    }

    if (txData.result.transaction.message.accountKeys[1] !== ADDRESS.toBase58()) {
      game.fake = true
      await game.save()

      return new Response(JSON.stringify({ message: "Payment was not made to the admin!" }), {
        status: 403,
        headers: {
          ...ACTIONS_CORS_HEADERS,
          'Content-Type': 'application/json'
        }
      })
    }

    const paymentAmount = txData.result.meta.postBalances[1] - txData.result.meta.preBalances[1]

    if (paymentAmount !== game.amount * LAMPORTS_PER_SOL) {
      game.fake = true
      await game.save()

      return new Response(JSON.stringify({ message: "Payment amount was incorrect!" }), {
        status: 403,
        headers: {
          ...ACTIONS_CORS_HEADERS,
          'Content-Type': 'application/json'
        }
      })
    }

    const commitment: Commitment = "confirmed"

    const connection = new Connection(process.env.ECLIPSE_RPC as string, commitment)

    const secretClient = new SecretManagerServiceClient()
    const [response] = await secretClient.accessSecretVersion({ name: `projects/435887166123/secrets/rocky-eclipse-private-key/versions/1` })
    if (!response.payload || !response.payload.data) {
      throw new Error('Secret payload is null or undefined')
    }
    const PRIVATE_KEY = response.payload.data.toString()

    // const PRIVATE_KEY = process.env.PRIVATE_KEY as string

    const KEYPAIR = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY))

    const transaction = new Transaction()

    const transferAmountSol = game.outcome === "win" ? 2 * Number(game.amount) : Number(game.amount)

    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 6969
      }),
      new TransactionInstruction({
        programId: new PublicKey(MEMO_PROGRAM_ID),
        data: Buffer.from(
          `${game.outcome}_${transferAmountSol}`,
          "utf8"
        ),
        keys: []
      }),
      SystemProgram.transfer({
        fromPubkey: KEYPAIR.publicKey,
        toPubkey: account,
        lamports: transferAmountSol * LAMPORTS_PER_SOL
      })
    )

    transaction.feePayer = account
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

    game.claimed = true
    await game.save()

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        type: "transaction",
        transaction,
        links: {
          next: {
            type: "post",
            href: `/api/actions/eclipse/postwin?id=${game._id.toString()}`
          }
        }
      },
      signers: [KEYPAIR]
    })

    return Response.json(payload)

  } catch (err) {
    console.error(err)
    return Response.json("An unknown error occured", { status: 500 })
  }
}
