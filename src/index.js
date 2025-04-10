
import dotenv from 'dotenv'
dotenv.config()
import connectDB from './db/index.js'
import { app } from './app.js'


connectDB()
.then(()=>{

    app.on("error", (error)=>{
        console.log("ERROR : ",error);
        throw error
    })

    app.listen(process.env.PORT || 3000, ()=>{
        console.log("Server is running at port")
    })
})
.catch((error)=>{
    console.log("MONGODB connection failed !!", error)
})





































// ;(async ()=>{
//     try {
//         await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
//         app.on("error", (error)=>{
//             console.log("ERROR : ",error);
//             throw error
//         })

//         app.listen(process.env.PORT,()=>{
//             console.log(`App is listening on port ${process.env.PORT}`)
//         })
//     } catch (error) {
//         console.error("ERROR : ",error)
//         throw error
//     }
// })()