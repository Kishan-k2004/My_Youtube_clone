import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js'
import {user} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import {ApiResponse} from '../utils/ApiResponse.js'
import jwt from 'jsonwebtoken'

const generateAccessAndRefreshTokens = async(userId)=>{
    try {
        const User = await user.findById(userId)
        const accessToken = User.generateAccessToken()
        const refreshToken = User.generateRefreshToken()

        User.refreshToken = refreshToken
        await User.save({validateBeforeSave : false})

        return {accessToken,refreshToken}

    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating access and refresh token")
    }
}

const registerUser = asyncHandler(async(req,res) => {
    {/*get user details from frontend -> validation -> check if user already exists -> check for images -> upload them to cloudinary -> create user object -> remove password and refresh token field from response -> check for user creation -> return res. */}

    const {fullname,username,email,password} = req.body

    // console.log("REQ FILES:", req.files);
    // console.log("REQ BODY:", req.body);
    
    if( [fullname,username,email,password].some((field)=> field?.trim() === "")){
        throw new ApiError(400,"All fields are required")
    }

    const existedUser = await user.findOne({
        $or : [{ username },{ email }]
    })

    if(existedUser){
        throw new ApiError(409,"User already exist")
    }
    
    const avtarLocalPath = req.files?.avatar?.[0]?.path
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path || ''

    if(!avtarLocalPath){
        throw new ApiError(400,"Avtar is required")
    }

    const avatar = await uploadOnCloudinary(avtarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avtar is required")
    }

    const User = await user.create({
        fullname,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        email,
        password,
        username : username.toLowerCase()

    })

    const createdUser = await user.findById(User._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "Something went wrong from server side")
    }

    return res.status(201).json(
        new ApiResponse(201,createdUser,"User register successfully")
    )

})

const loginUser = asyncHandler(async(req,res) => {
    {/*req body -> username or email -> find the user -> password check -> access and refresh token -> send cookie */}

    const {email,password} = req.body

    if(!email){
       throw new ApiError(400,"email is required")
    }

    const User = await user.findOne({email})

    if(!User){
        throw new ApiError(404,"User not found")
    }

    const isPasswordValid = await User.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid password")
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(User._id)

    const loggedInUser = await user.findById(User._id)
    .select("-password -refreshToken")


    const options = {
        httOnly : true,
        secure : true
    }

    return res.status(200)
    .cookie("accessToken",accessToken, options)
    .cookie("refreshToken",refreshToken,options)
    .json(new ApiResponse(200,{User : loggedInUser,accessToken,refreshToken},"User logged in Successfully"))

})

const logoutUser = asyncHandler(async(req,res) => {
    
    await user.findByIdAndUpdate(
        req.User._id,
        {
            $set : {
                refreshToken : undefined
            }
        },
        {
            new : true
        }
    )

    const options = {
        httOnly : true,
        secure : true
    }

    return res.status(200).clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logged Out"))
})

const refreshAccessToken = asyncHandler(async(req,res) => {
    const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "unauthorised request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
        const User = await user.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401,"Invalid refresh Token")
        }
    
        if(incomingRefreshToken !== User?.refreshToken){
            throw new ApiError(401 , "Refreah token is expired or used")
        }
    
        const options = {
            httOnly : true,
            secure : true
        }
    
        const {accessToken,newrefreshToken} = await generateAccessAndRefreshTokens(User._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newrefreshToken, options)
        .json(
            new ApiResponse(200,{accessToken,refreshToken : newrefreshToken},"Access token refreshed")
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid refresh Token")
        
    }
})

const changeCurrentPassword = asyncHandler(async(req,res) => {
    const {oldPassword,newPassword} = req.body

    const User = await user.findById(req.User?._id)
    const isPasswordCorrect = await User.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old password")
    }

    User.password = newPassword
    await User.save({validationBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password change successfully"))

})

const getCurrentUser = asyncHandler(async(req,res) =>{
    return res.status(200)
    .json(200,req.User,"Current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async(req,res) =>{
    const {fullname, email} = req.body

    if(!fullname || !email){
        throw new ApiError(400,"All fields are required")
    }

    const User = user.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,email
            }
        },
        {new : true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,User,"Account details updated successfully"))

})

const updateUserAvatar = asyncHandler(async(req,res) =>{
    const avtarLocalPath = req.file?.path

    if(!avtarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avtarLocalPath)

    if(!avatar.url){
        throw new ApiError(400,"Error while uploading on avatar")
    }

    const User = await user.findByIdAndUpdate(
        req.User._id,
        {
            $set: {
                avatar : avatar.url
            }
        },
        {new : true}
    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(200,User,"Avatar updated successfully"))

})

const updateUserCoverImage = asyncHandler(async(req,res) =>{
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading Cover image")
    }

    const User = await user.findByIdAndUpdate(
        req.User._id,
        {
            $set: {
                coverImage : coverImage.url
            }
        },
        {new : true}
    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(200,User,"Cover image updated successfully"))
})

const getUserChannelProfile = asyncHandler(async(res,req) =>{
    const {username} = req.params

    if(!username?.trim()){
        throw new ApiError(400,"username is missing")
    }

    const channel = await user.aggregate([
        {
            $match: {
                username : username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from : "subscriptions",
                localField : "_id",
                foreignField : "channel",
                as : "subscriber"
            }
        },
        {
            $lookup: {
                from : "subscriptions",
                localField : "_id",
                foreignField : "subscriber",
                as : "subscribedTo"
            }
        },
        {
            $addFields : {
                subscribersCount : {
                    $size : "$subscribers"
                },
                channelsSubscribedToCount : {
                    $size : "$subscribedTo"
                },
                isSubscribed : {
                    $cond : {
                        if : {$in : [req.User?._id,"subscribers.subscriber"]},
                        then : true,
                        else : false
                    }
                }
            }
        },
        {
            $project : {
                fullName : 1,
                username : 1,
                subscribersCount : 1,
                channelsSubscribedToCount : 1,
                isSubscribed : 1,
                avatar : 1,
                coverImage : 1,
                email : 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404,"channel does not exist")
    }

    return res
    .status(200)
    .json(new ApiResponse(200,channel[0],"user channel fetched successfully"))


})



export {getUserChannelProfile,registerUser,loginUser,logoutUser,getCurrentUser,refreshAccessToken,changeCurrentPassword,updateAccountDetails,updateUserAvatar,updateUserCoverImage}