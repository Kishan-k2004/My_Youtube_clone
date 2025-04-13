import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js'
import {user} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import {ApiResponse} from '../utils/ApiResponse.js'


const registerUser = asyncHandler(async(req,res) => {
    {/*get user details from frontend -> validation -> check if user already exists -> check for images -> upload them to cloudinary -> create user object -> remove password and refresh token field from response -> check for user creation -> return res. */}

    const {fullname,username,email,password} = req.body
    
    if( [fullname,username,email,password].some((field)=> field?.trim() === "")){
        throw new ApiError(400,"All fields are required")
    }

    const existedUser = user.findOne({
        $or : [{ username },{ email }]
    })

    if(existedUser){
        throw new ApiError(409,"User already exist")
    }
    
    const avtarLocalPath = req.files?.avatar[0]?.path
    const coverImageLocalPath = req.files?.coverImage[0]?.path

    if(!avtarLocalPath){
        throw new ApiError(400,"Avtar is required")
    }

    const avatar = await uploadOnCloudinary(avtarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avtar is required")
    }

    const User = awaituser.create({
        fullname,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        email,
        password,
        username : username.toLowerCase()

    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "Something went wrong from server side")
    }

    return res.status(201).json(
        new ApiResponse(200,"User register successfully")
    )

})

export {registerUser}